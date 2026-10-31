// services/tts-service.js
//
// Phase 3：腾讯云 TTS 备用方案（个人主体小程序不能用微信同传插件 WechatSI）。
//
// 对外接口（与未来切换其它实现兼容）：
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

// 内存缓存：避免同一条目朗读 N 次时重复调云函数（每次重读省一次 API + 800 万字符配额）
const audioCache = new Map()

let currentAudioContext = null
let currentAudioResolve = null

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

    const ctx = wx.createInnerAudioContext()
    currentAudioContext = ctx
    currentAudioResolve = resolve

    // 实例级兜底：基础库 2.3.0 起官方已改为全局 wx.setInnerAudioOption，
    // 实例属性不再生效；但在 2.3.0 之前的低版本客户端上，
    // 唯一能让 iOS 静音模式出声的方式就是设置这个实例属性。
    // 这里两个都设：低版本靠实例属性生效，新版本靠 app.js 的全局配置。
    try {
      ctx.obeyMuteSwitch = false
    } catch (e) {
      // 低版本基础库不支持该属性，忽略即可
    }

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
      }
      reject(err)
    })

    ctx.play()
  })
}

function _finalize(reason) {
  if (currentAudioContext) {
    try { currentAudioContext.destroy() } catch (e) {}
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
    try { currentAudioContext.destroy() } catch (e) {}
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

module.exports = {
  generateSpeech,
  playAudio,
  stopAudio,
  clearCache
}
