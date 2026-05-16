const { saveSession } = require('../../utils/db')
const { compareWords } = require('../../utils/compare')

Page({
  data: {
    words: [],
    results: [],
    correctCount: 0,
    scorePercent: 0,
    hasResult: false,
    loading: false
  },

  onLoad(options) {
    const words = JSON.parse(options.words || '[]')
    this.setData({ words })
  },

  uploadAnswer() {
    if (this.data.loading) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.runOCR(tempFilePath)
      }
    })
  },

  async runOCR(filePath) {
    this.setData({ loading: true })
    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr/${Date.now()}.jpg`,
        filePath
      })
      const ocrRes = await wx.cloud.callFunction({
        name: 'ocrWords',
        data: { fileID: uploadRes.fileID }
      })
      const writtenWords = ocrRes.result.words || []
      this.processResult(writtenWords)
    } catch (e) {
      console.error('OCR error', e)
      wx.showToast({ title: 'OCR 识别失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  processResult(writtenWords) {
    const { words } = this.data
    const results = compareWords(words, writtenWords)
    const correctCount = results.filter(r => r.correct).length
    const scorePercent = Math.round((correctCount / words.length) * 100)
    this.setData({ results, correctCount, scorePercent, hasResult: true })
    saveSession({ words, result: results, score: correctCount, total: words.length })
      .catch(e => console.error('保存记录失败', e))
  },

  finish() {
    wx.navigateTo({ url: '/pages/profile/index' })
  }
})
