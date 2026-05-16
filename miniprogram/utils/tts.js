function playWord(word) {
  return new Promise((resolve, reject) => {
    const audio = wx.createInnerAudioContext()
    audio.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    audio.onEnded(() => {
      audio.destroy()
      resolve()
    })
    audio.onError((err) => {
      audio.destroy()
      reject(err)
    })
    audio.play()
  })
}

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

module.exports = { playWord, sleep }
