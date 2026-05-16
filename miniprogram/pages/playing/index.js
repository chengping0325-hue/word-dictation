const { playWord, sleep } = require('../../utils/tts')

Page({
  data: {
    words: [],
    playCount: 2,
    interval: 3,
    currentIndex: 0,
    playingCount: 1,
    playedCount: 0,
    dotsArray: [],
    isPlaying: false,
    paused: false,
    countdown: 0,
    finished: false
  },

  _stopped: false,
  _countdownTimer: null,

  onLoad(options) {
    const words = JSON.parse(options.words || '[]')
    const playCount = parseInt(options.playCount || 2)
    const interval = parseInt(options.interval || 3)
    this.setData({
      words,
      playCount,
      interval,
      dotsArray: Array(playCount).fill(0)
    })
    this.startFlow()
  },

  onUnload() {
    this._stopped = true
    if (this._countdownTimer) clearInterval(this._countdownTimer)
  },

  async startFlow() {
    const { words, playCount, interval } = this.data
    for (let i = 0; i < words.length; i++) {
      if (this._stopped) return
      this.setData({ currentIndex: i, playedCount: 0, playingCount: 1, countdown: 0 })
      for (let p = 0; p < playCount; p++) {
        if (this._stopped) return
        while (this.data.paused) await sleep(0.3)
        this.setData({ isPlaying: true, playingCount: p + 1 })
        try {
          await playWord(words[i])
        } catch (e) {
          console.error('TTS error', e)
        }
        this.setData({ isPlaying: false, playedCount: p + 1 })
        if (p < playCount - 1) await this.runCountdown(interval)
      }
      if (i < words.length - 1) {
        await sleep(1.5)
      }
    }
    if (!this._stopped) {
      this.setData({ finished: true })
      setTimeout(() => {
        if (!this._stopped) {
          wx.redirectTo({
            url: `/pages/grading/index?words=${JSON.stringify(words)}`
          })
        }
      }, 1500)
    }
  },

  runCountdown(seconds) {
    return new Promise(resolve => {
      this.setData({ countdown: seconds })
      this._countdownTimer = setInterval(() => {
        if (this._stopped) { clearInterval(this._countdownTimer); resolve(); return }
        if (this.data.paused) return
        const next = this.data.countdown - 1
        if (next <= 0) {
          clearInterval(this._countdownTimer)
          this.setData({ countdown: 0 })
          resolve()
        } else {
          this.setData({ countdown: next })
        }
      }, 1000)
    })
  },

  togglePause() {
    this.setData({ paused: !this.data.paused })
  },

  goBack() {
    this._stopped = true
    if (this._countdownTimer) clearInterval(this._countdownTimer)
    wx.navigateBack()
  }
})
