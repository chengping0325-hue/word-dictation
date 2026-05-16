// miniprogram/utils/tts.js
function isChinese(word) {
  return /[一-龥]/.test(word)
}

function buildUrl(word) {
  // 有道 dictvoice：type=2 英文，type=1 中文（实测中文支持有限，
  // 失败时调用方应当跳过而不阻塞）
  const type = isChinese(word) ? 1 : 2
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

function playWord(word) {
  return new Promise((resolve, reject) => {
    const audio = wx.createInnerAudioContext()
    audio.src = buildUrl(word)
    let done = false
    const finish = (err) => {
      if (done) return
      done = true
      audio.destroy()
      err ? reject(err) : resolve()
    }
    audio.onEnded(() => finish())
    audio.onError((e) => finish(e))
    audio.play()
  })
}

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

module.exports = { playWord, sleep, isChinese }
