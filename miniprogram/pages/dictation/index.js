Page({
  data: {
    words: [],
    inputWord: '',
    playCount: 2,
    interval: 3
  },

  onInput(e) {
    this.setData({ inputWord: e.detail.value })
  },

  addWord() {
    const word = this.data.inputWord.trim()
    if (!word) return
    const words = [...this.data.words, word]
    this.setData({ words, inputWord: '' })
  },

  deleteWord(e) {
    const index = e.currentTarget.dataset.index
    const words = this.data.words.filter((_, i) => i !== index)
    this.setData({ words })
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有单词吗？',
      success: (res) => {
        if (res.confirm) this.setData({ words: [] })
      }
    })
  },

  decPlayCount() {
    if (this.data.playCount <= 1) return
    this.setData({ playCount: this.data.playCount - 1 })
  },

  incPlayCount() {
    if (this.data.playCount >= 5) return
    this.setData({ playCount: this.data.playCount + 1 })
  },

  decInterval() {
    if (this.data.interval <= 1) return
    this.setData({ interval: this.data.interval - 1 })
  },

  incInterval() {
    if (this.data.interval >= 10) return
    this.setData({ interval: this.data.interval + 1 })
  },

  goWordBook() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  photoOCR() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.runPhotoOCR(filePath)
      }
    })
  },

  async runPhotoOCR(filePath) {
    wx.showLoading({ title: '识别中...' })
    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr-input/${Date.now()}.jpg`,
        filePath
      })
      const ocrRes = await wx.cloud.callFunction({
        name: 'ocrWords',
        data: { fileID: uploadRes.fileID }
      })
      const recognized = ocrRes.result.words || []
      if (recognized.length === 0) {
        wx.showToast({ title: '未识别到单词，请重拍', icon: 'none' })
        return
      }
      const words = [...this.data.words, ...recognized]
      this.setData({ words })
      wx.showToast({ title: `识别到 ${recognized.length} 个单词`, icon: 'success' })
    } catch (e) {
      wx.showToast({ title: 'OCR 识别失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  startDictation() {
    if (this.data.words.length === 0) return
    wx.navigateTo({
      url: `/pages/playing/index?words=${JSON.stringify(this.data.words)}&playCount=${this.data.playCount}&interval=${this.data.interval}`
    })
  }
})
