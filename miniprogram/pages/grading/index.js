const { recognizeWords } = require('../../utils/ocr')
const { compareWords } = require('../../utils/compare')
const { saveSession } = require('../../utils/db')

Page({
  data: {
    state: 'upload',  // 'upload' | 'loading' | 'result'
    words: [],
    results: [],
    correctCount: 0,
    scorePercent: 0,
    playCount: 2,
    interval: 3
  },

  onLoad(options) {
    const words = JSON.parse(decodeURIComponent(options.words || '[]'))
    this.setData({ words })
  },

  uploadAnswer() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        this.setData({ state: 'loading' })
        try {
          const recognized = await recognizeWords(res.tempFiles[0].tempFilePath)
          this.processResult(recognized)
        } catch (e) {
          console.error('OCR error', e)
          wx.showToast({ title: e.message || '识别失败，请重试', icon: 'none' })
          this.setData({ state: 'upload' })
        }
      }
    })
  },

  processResult(writtenWords) {
    const { words } = this.data
    const results = compareWords(words, writtenWords)
    const correctCount = results.filter(r => r.correct).length
    const scorePercent = Math.round((correctCount / words.length) * 100)
    this.setData({ results, correctCount, scorePercent, state: 'result' })
    saveSession({
      words, result: results, score: correctCount, total: words.length,
      settings: { playCount: this.data.playCount, interval: this.data.interval }
    }).catch(e => console.error('保存记录失败', e))
  },

  finish() {
    wx.redirectTo({ url: '/pages/wordbook/index' })
  }
})
