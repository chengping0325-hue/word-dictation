// services/tts-service.test.js
// 验证 iOS 音频会话唤醒相关的静态资源与代码约定。
//
// 背景：iOS 上 InnerAudioContext 默认以 ambient 类别激活音频会话，
// 该类别受静音键压制 → 手机静音时听写全程无声。
// 解决办法是在用户手势内播放一段静音音频把会话唤醒到 playback 类别。
// 详见 services/tts-service.js 顶部说明与 docs/04-服务集成.md 第 2.7 节。
//
// 运行：node miniprogram/services/tts-service.test.js

const fs = require('fs')
const path = require('path')

const ASSETS_DIR = path.join(__dirname, '..', 'assets')
const SILENCE_FILE = path.join(ASSETS_DIR, 'silence.mp3')
const SERVICE_FILE = path.join(__dirname, 'tts-service.js')
const HOME_PAGE = path.join(__dirname, '..', 'pages', 'dictation', 'index', 'index.js')

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    const result = fn()
    if (result === true) {
      console.log(`  ✓ ${name}`)
      passed++
    } else {
      console.log(`  ✗ ${name}${result ? ' → ' + result : ''}`)
      failed++
    }
  } catch (err) {
    console.log(`  ✗ ${name} → 异常: ${err && err.message}`)
    failed++
  }
}

// ── 1. 静音唤醒文件 ──
console.log('\nunlockAudio 静音唤醒文件:')

check('silence.mp3 存在于包内 assets/', () => {
  return fs.existsSync(SILENCE_FILE) || '文件缺失: miniprogram/assets/silence.mp3'
})

check('silence.mp3 体积 < 5KB（不能占用包体）', () => {
  if (!fs.existsSync(SILENCE_FILE)) return '文件缺失'
  const size = fs.statSync(SILENCE_FILE).size
  return size < 5 * 1024 || `实际 ${size} 字节`
})

check('silence.mp3 是 MP3 格式（iOS XWeb 内核对 AAC 支持不稳定）', () => {
  if (!fs.existsSync(SILENCE_FILE)) return '文件缺失'
  const head = fs.readFileSync(SILENCE_FILE).slice(0, 3)
  // MP3 文件头：ID3 标签 或 MPEG 帧同步字 0xFF 0xFB/0xFA/0xF3...
  const isID3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33  // 'ID3'
  const isFrame = head[0] === 0xFF && (head[1] & 0xE0) === 0xE0
  return (isID3 || isFrame) || `文件头不是 MP3: ${head.toString('hex')}`
})

check('silence.mp3 采样率为 44100Hz', () => {
  if (!fs.existsSync(SILENCE_FILE)) return '文件缺失'
  // 不做位解析（MPEG 帧头的采样率字段在不同编码器下写法不一致，
  // 手工解析会误判）。改为检查文件里是否包含 44100Hz 的频率标识。
  const buf = fs.readFileSync(SILENCE_FILE)
  // ID3v2 里可以存 TXXX/TSSE 等帧，LAME 编码器会写 "LAME3.100" 之类
  const asText = buf.toString('latin1')
  if (/44100/.test(asText)) return true

  // 回退：检查帧头里是否存在 44100 对应的采样率索引（0）
  let off = 0
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) |
                 ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    off = 10 + size
  }
  // 扫描所有帧同步字，找版本位=3(MPEG1) 且采样率索引=0(44100) 的帧
  for (let i = off; i < Math.min(buf.length - 4, off + 400); i++) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) continue
    const ver = (buf[i + 1] >> 3) & 0x03
    const srIdx = (buf[i + 2] >> 6) & 0x03
    if (ver === 3 && srIdx === 0) return true
  }
  return '未找到 44100Hz 的 MPEG1 Layer3 帧（ffmpeg 解码确认应为 44100Hz）'
})

// ── 2. tts-service.js 代码约定 ──
console.log('\ntts-service.js 实现约定:')

const serviceSrc = fs.existsSync(SERVICE_FILE) ? fs.readFileSync(SERVICE_FILE, 'utf8') : ''

check('导出 unlockAudio', () => {
  return /module\.exports\s*=\s*\{[\s\S]*unlockAudio/.test(serviceSrc) || '未导出 unlockAudio'
})

check('导出 destroy', () => {
  return /module\.exports\s*=\s*\{[\s\S]*\bdestroy\b/.test(serviceSrc) || '未导出 destroy'
})

check('unlockAudio 引用了 /assets/silence.mp3', () => {
  return /'\/assets\/silence\.mp3'/.test(serviceSrc) || '未引用静音文件路径'
})

check('unlockAudio 内设置 volume = 0（双保险，避免底噪）', () => {
  const m = serviceSrc.match(/function unlockAudio\(\)\s*\{[\s\S]*?\n\}/)
  if (!m) return '未找到 unlockAudio 函数体'
  return /\.volume\s*=\s*0/.test(m[0]) || '未设置 volume = 0'
})

check('playAudio 复用共享实例（避免每次新建导致会话类别重置）', () => {
  return /sharedContext/.test(serviceSrc) || '未使用 sharedContext 复用实例'
})

check('_finalize 只 stop 不 destroy（销毁会丢掉已激活的会话类别）', () => {
  const m = serviceSrc.match(/function _finalize\([^)]*\)\s*\{[\s\S]*?\n\}/)
  if (!m) return '未找到 _finalize 函数体'
  // 去掉注释再判断，避免注释里的 "destroy()" 字样造成误判
  const code = m[0].replace(/\/\/[^\n]*/g, '')
  if (/destroy\s*\(/.test(code)) return '_finalize 里仍有 destroy() 调用'
  return true
})

check('_internalStop 只 stop 不 destroy', () => {
  const m = serviceSrc.match(/function _internalStop\(\)\s*\{[\s\S]*?\n\}/)
  if (!m) return '未找到 _internalStop 函数体'
  const code = m[0].replace(/\/\/[^\n]*/g, '')
  if (/destroy\s*\(/.test(code)) return '_internalStop 里仍有 destroy() 调用'
  return true
})

check('仍保留全局 wx.setInnerAudioOption 的兜底说明', () => {
  return /obeyMuteSwitch/.test(serviceSrc) || '未提及 obeyMuteSwitch'
})

// ── 3. 主页手势调用位置 ──
console.log('\n主页「开始听写」手势调用:')

const homeSrc = fs.existsSync(HOME_PAGE) ? fs.readFileSync(HOME_PAGE, 'utf8') : ''

check('主页引入了 tts-service', () => {
  return /require\(['"][^'"]*tts-service['"]\)/.test(homeSrc) || '未引入 tts-service'
})

check('onStart 中调用了 tts.unlockAudio()', () => {
  const m = homeSrc.match(/onStart\s*\(\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onStart 函数体'
  return /tts\.unlockAudio\(\)/.test(m[0]) || 'onStart 内未调用 unlockAudio'
})

check('unlockAudio 在 navigateTo 之前调用（必须在手势同步栈内）', () => {
  const m = homeSrc.match(/onStart\s*\(\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onStart 函数体'
  const body = m[0]
  const unlockIdx = body.indexOf('tts.unlockAudio()')
  const navIdx = body.indexOf('wx.navigateTo')
  if (unlockIdx < 0) return '未调用 unlockAudio'
  if (navIdx < 0) return '未找到 navigateTo'
  return unlockIdx < navIdx || 'unlockAudio 在 navigateTo 之后（会脱离手势栈）'
})

// ── 汇总 ──
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
