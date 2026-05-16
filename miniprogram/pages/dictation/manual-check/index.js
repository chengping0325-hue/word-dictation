// pages/dictation/manual-check/index.js
// Phase 2 阶段：逐题翻牌，全部核对完毕后生成结果跳到 ⑦
const { getTypeLabel } = require('../../../services/type-detector')

Page({
  data: {
    list: [],
    total: 0,
    currentIndex: 0,
    currentItem: null,
    typeLabel: '',
    checked: []   // [{ ...item, isCorrect }]
  },

  onLoad() {
    const app = getApp()
    const cd = app.globalData.currentDictation
    if (!cd || !Array.isArray(cd.list) || cd.list.length === 0) {
      wx.showToast({ title: '没有听写记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    this._setIndex(0, cd.list)
    this.setData({ total: cd.list.length, list: cd.list })
  },

  _setIndex(i, list) {
    const items = list || this.data.list
    if (i >= items.length) return
    const cur = items[i]
    this.setData({
      currentIndex: i,
      currentItem: cur,
      typeLabel: getTypeLabel(cur.type)
    })
  },

  onCorrect() { this._record(true) },
  onWrong()   { this._record(false) },

  _record(isCorrect) {
    const cur = this.data.currentItem
    if (!cur) return
    const checked = this.data.checked.concat([{
      content: cur.content,
      type: cur.type,
      isCorrect
    }])
    this.setData({ checked })
    this._advance()
  },

  onSkip() {
    // 跳过：当作错处理（也可以选择不记录，但 PRD 4.6 节说跳过仍进入判分清单。错的判定更安全）
    const cur = this.data.currentItem
    if (!cur) return
    const checked = this.data.checked.concat([{
      content: cur.content,
      type: cur.type,
      isCorrect: false,
      skipped: true
    }])
    this.setData({ checked })
    this._advance()
  },

  _advance() {
    const next = this.data.currentIndex + 1
    if (next >= this.data.total) {
      this._finish()
    } else {
      this._setIndex(next)
    }
  },

  _finish() {
    const items = this.data.checked
    const correct = items.filter(i => i.isCorrect).length
    const total = items.length
    const result = {
      score: { correct, total, rate: total > 0 ? correct / total : 0 },
      items,
      mode: 'manual'
    }
    const app = getApp()
    app.globalData.currentResult = result
    wx.redirectTo({ url: '/pages/dictation/result/index' })
  }
})
