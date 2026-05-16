const { chooseAndRecognize } = require('../../utils/ocr')

Page({
  data: {
    words: [],
    inputWord: '',
    playCount: 2,
    interval: 3,
    dragIndex: -1
  },

  _dragStartY: 0,
  _rowHeight: 88,

  onInput(e) { this.setData({ inputWord: e.detail.value }) },

  addWord() {
    const word = this.data.inputWord.trim()
    if (!word) return
    this.setData({ words: [...this.data.words, word], inputWord: '' })
  },

  deleteWord(e) {
    const i = e.currentTarget.dataset.index
    this.setData({ words: this.data.words.filter((_, idx) => idx !== i) })
  },

  // ---- Drag-sort ----
  startDrag(e) {
    const index = e.currentTarget.dataset.index
    this._dragStartY = e.changedTouches[0].pageY
    this.setData({ dragIndex: index })
    wx.vibrateShort({ type: 'light' })
  },

  onDrag(e) {
    if (this.data.dragIndex < 0) return
    const dy = e.changedTouches[0].pageY - this._dragStartY
    const moveSlots = Math.round(dy / this._rowHeight)
    const newIndex = Math.min(
      Math.max(this.data.dragIndex + moveSlots, 0),
      this.data.words.length - 1
    )
    if (newIndex !== this.data.dragIndex) {
      const words = [...this.data.words]
      const [moved] = words.splice(this.data.dragIndex, 1)
      words.splice(newIndex, 0, moved)
      this._dragStartY = e.changedTouches[0].pageY
      this.setData({ words, dragIndex: newIndex })
    }
  },

  endDrag() {
    this.setData({ dragIndex: -1 })
  },

  // ---- Steppers ----
  decPlayCount() { if (this.data.playCount > 1) this.setData({ playCount: this.data.playCount - 1 }) },
  incPlayCount() { if (this.data.playCount < 5) this.setData({ playCount: this.data.playCount + 1 }) },
  decInterval() { if (this.data.interval > 1) this.setData({ interval: this.data.interval - 1 }) },
  incInterval() { if (this.data.interval < 10) this.setData({ interval: this.data.interval + 1 }) },

  // ---- OCR ----
  async photoOCR() {
    wx.showLoading({ title: '识别中...' })
    try {
      const recognized = await chooseAndRecognize()
      if (!recognized.length) {
        wx.showToast({ title: '未识别到单词', icon: 'none' })
        return
      }
      this.setData({ words: [...this.data.words, ...recognized] })
      wx.showToast({ title: `识别到 ${recognized.length} 个`, icon: 'success' })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: e.message || '识别失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  startDictation() {
    if (!this.data.words.length) return
    wx.navigateTo({
      url: `/pages/playing/index?words=${encodeURIComponent(JSON.stringify(this.data.words))}&playCount=${this.data.playCount}&interval=${this.data.interval}`
    })
  }
})
