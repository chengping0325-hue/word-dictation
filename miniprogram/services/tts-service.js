// services/tts-service.js
//
// Phase 3：腾讯云 TTS 备用方案（个人主体小程序不能用微信同传插件 WechatSI）。
//
// 对外接口（与未来切换其它实现兼容）：
//   unlockAudio() → 在用户手势回调内调用，唤醒 iOS 音频会话（见下方说明）
//   generateSpeech(text, lang) → Promise<{ audioUrl }>
//     lang: 'en_US' | 'zh_CN'（与 type-detector.getLang 对齐）
//     audioUrl: 本地临时文件路径，可直接喂给 wx.createInnerAudioContext
//   playAudio(audioUrl) → Promise<'ended' | 'stopped'>
//     播放完成时 resolve('ended')；被 stopAudio 中断时 resolve('stopped')
//   stopAudio() → 立即停止当前播放并 resolve 在播 Promise
//
// 实现细节：
//   - generateSpeech 走 tts 云函数 → 拿到 base64 → 写到 USER_DATA_PATH 临时文件
//   - 同一个 (lang, text) 缓存 audioUrl，readCount 多次重读不重复调云函数
//
// ── iOS 静音开关为什么需要 unlockAudio ──
//
// 现象：iOS 真机把手机拨到静音，听写全程无声（不静音时正常）。
//
// 原因：iOS 的音频会话（AVAudioSession）在**首次 play() 时**才被激活。
// 如果首次 play() 不在用户手势的同步调用栈内（例如 navigateTo 之后
// 在 onLoad 里等云函数返回再播），系统会以 `ambient` 类别激活会话 ——
// ambient 类别**受静音键压制**，于是不静音能出声、静音就静。
//
// 解决：在用户点击「开始听写」的手势回调里，先播一个 80ms 的静音文件，
// 把音频会话以 playback 类别激活（playback 不受静音键影响）。
// 会话一旦激活，后续所有 play() 都继承这个类别，静音模式下也能出声。
//
// 关键约束（缺一不可）：
//   1. 必须在**用户手势的同步回调栈内**调用，异步 setTimeout / await 之后调用无效
//   2. 静音文件必须是真实音频文件（不能是空文件），时长 > 0
//   3. 必须是 MP3 格式 + 44100Hz（iOS 的 XWeb 内核对 AAC 支持不稳定）
//
// 详见 docs/04-服务集成.md 第 2.7 节。

// 内存缓存：避免同一条目朗读 N 次时重复调云函数（每次重读省一次 API + 800 万字符配额）
const audioCache = new Map()

let currentAudioContext = null
let currentAudioResolve = null

// 全局共享的播放实例。iOS 的音频会话类别在首次 play() 时确定，
// 复用同一实例才能稳定继承该类别（详见 unlockAudio 的说明）。
let sharedContext = null

// 会话是否已被唤醒（避免重复创建实例）
let audioUnlocked = false

/**
 * 在用户手势回调内唤醒 iOS 音频会话。
 *
 * ⚠️ 必须从 bindtap / bindtouchstart 这类用户手势的**同步栈**里调用。
 *    放进 setTimeout / await 之后调用会失效（那已经不是手势上下文了）。
 *
 * 副作用：无（播放 80ms 静音，人耳听不见）
 */
function unlockAudio() {
  if (audioUnlocked) return

  const ctx = wx.createInnerAudioContext()
  // 实例级兜底：基础库 2.3.0 起官方已改为全局 wx.setInnerAudioOption，
  // 实例属性不再生效；2.3.0 之前这是唯一生效的方式。
  try {
    ctx.obeyMuteSwitch = false
  } catch (e) {}

  ctx.volume = 0        // 双保险：即使静音文件有轻微底噪也听不到
  ctx.src = '/assets/silence.mp3'

  ctx.onEnded(() => {
    try { ctx.destroy() } catch (e) {}
    audioUnlocked = true
    console.log('[tts-service] 音频会话已唤醒')
  })

  ctx.onError((err) => {
    console.warn('[tts-service] 唤醒音频会话失败（不影响播放）:', err && err.errMsg)
    try { ctx.destroy() } catch (e) {}
    // 标记为已尝试过，避免每次点「开始听写」都重复尝试
    audioUnlocked = true
  })

  ctx.play()
}

/**
 * 重置唤醒状态（小程序被销毁重建时调用）
 */
function resetUnlockState() {
  audioUnlocked = false
}

function generateSpeech(text, lang) {
  return new Promise((resolve, reject) => {
    if (!text) return reject(new Error('text 为空'))
    if (!lang) return reject(new Error('lang 为空'))

    const cacheKey = `${lang}|${text}`
    if (audioCache.has(cacheKey)) {
      return resolve({ audioUrl: audioCache.get(cacheKey) })
    }

    // type-detector 返回的 lang 是 'en_US' / 'zh_CN'，云函数约定是 'en' / 'zh'
    const cfLang = (lang === 'en_US') ? 'en' : 'zh'

    wx.cloud.callFunction({
      name: 'tts',
      data: { text, lang: cfLang }
    }).then(res => {
      const r = res && res.result
      if (!r || !r.success) {
        const msg = (r && r.error) || 'TTS 云函数返回失败'
        throw new Error(msg)
      }
      if (!r.audioBase64) {
        throw new Error('TTS 云函数未返回 audioBase64')
      }
      return _writeBase64ToTempFile(r.audioBase64, r.format || 'mp3')
    }).then(filePath => {
      audioCache.set(cacheKey, filePath)
      resolve({ audioUrl: filePath })
    }).catch(err => {
      console.error('[tts-service] generateSpeech failed:', err && err.message)
      reject(err)
    })
  })
}

function _writeBase64ToTempFile(base64, format) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: (err) => reject(new Error(`写音频文件失败: ${err && err.errMsg}`))
    })
  })
}

function playAudio(audioUrl) {
  return new Promise((resolve, reject) => {
    // 单实例：先停掉前一个
    _internalStop()

    // 复用同一个 InnerAudioContext 实例。
    // 原因：iOS 的音频会话类别在**首次 play()** 时确定，之后由该实例继承。
    // 如果每次播放都 createInnerAudioContext()，新实例可能重新走一次
    // 「非用户手势激活」路径落回 ambient 类别，导致 iOS 静音模式下又没声。
    // 配合 unlockAudio() 在手势内预热，这里复用实例即可稳定继承 playback 类别。
    if (!sharedContext) {
      sharedContext = wx.createInnerAudioContext()

      // 实例级兜底：基础库 2.3.0 起官方已改为全局 wx.setInnerAudioOption，
      // 实例属性不再生效；但在 2.3.0 之前的低版本客户端上，
      // 唯一能让 iOS 静音模式出声的方式就是设置这个实例属性。
      // 这里两个都设：低版本靠实例属性生效，新版本靠 app.js 的全局配置。
      try {
        sharedContext.obeyMuteSwitch = false
      } catch (e) {
        // 低版本基础库不支持该属性，忽略即可
      }
    }

    const ctx = sharedContext
    currentAudioContext = ctx
    currentAudioResolve = resolve

    ctx.src = audioUrl

    ctx.onEnded(() => {
      _finalize('ended')
    })

    ctx.onError((err) => {
      console.error('[tts-service] playAudio error:', err)
      // onError 不走 _finalize（_finalize 是按"已知 resolve"语义），直接 reject
      if (currentAudioResolve === resolve) {
        currentAudioResolve = null
      }
      if (currentAudioContext === ctx) {
        try { ctx.destroy() } catch (e) {}
        currentAudioContext = null
        sharedContext = null
      }
      reject(err)
    })

    ctx.play()
  })
}

function _finalize(reason) {
  // 只 stop() 不 destroy()：销毁实例会把刚激活的 iOS 音频会话类别一起丢掉，
  // 下次播放就得重新走一遍「非手势激活」路径，又落回 ambient（静音键压制）。
  if (currentAudioContext) {
    try { currentAudioContext.stop() } catch (e) {}
    currentAudioContext = null
  }
  if (currentAudioResolve) {
    const r = currentAudioResolve
    currentAudioResolve = null
    r(reason)
  }
}

function _internalStop() {
  if (currentAudioContext) {
    try { currentAudioContext.stop() } catch (e) {}
    currentAudioContext = null
  }
}

function stopAudio() {
  _internalStop()
  if (currentAudioResolve) {
    const r = currentAudioResolve
    currentAudioResolve = null
    r('stopped')
  }
}

function clearCache() {
  audioCache.clear()
}

/**
 * 完全释放音频实例。
 * 只在需要彻底重置时调用（如小程序被销毁重建）。
 * 普通的「停止播放」用 stopAudio()，不要用这个 —— destroy 会丢掉
 * 已激活的 iOS 音频会话类别。
 */
function destroy() {
  _internalStop()
  if (sharedContext) {
    try { sharedContext.destroy() } catch (e) {}
    sharedContext = null
  }
  if (currentAudioResolve) {
    const r = currentAudioResolve
    currentAudioResolve = null
    r('stopped')
  }
  resetUnlockState()
}

module.exports = {
  unlockAudio,
  resetUnlockState,
  generateSpeech,
  playAudio,
  stopAudio,
  clearCache,
  destroy
}
