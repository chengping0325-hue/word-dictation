// pages/dictation/ocr-confirm/index.js
// 入：globalData.pendingOcrResult.items = [{ content, type, suspicious }]
// 出：globalData.pendingOcrResult.confirmed = [{ content, type }] → 主页 onShow 合入
const { detectType } = require('../../../services/type-detector')

Page({
  data: {
    items: [],
    totalCount: 0,
    suspiciousCount: 0
  },

  onLoad() {
    const app = getApp()
    const incoming = (app.globalData.pendingOcrResult || {}).items
    if (!Array.isArray(incoming) || incoming.length === 0) {
      wx.showToast({ title: '没有识别结果', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    // 每项加 id 便于 wx:key 与删除
    const items = incoming.map((it, i) => ({
      id: `ocr-${Date.now()}-${i}`,
      content: it.content,
      type: it.type || detectType(it.content),
      suspicious: !!it.suspicious
    }))
    this._refresh(items)
  },

  _refresh(items) {
    const suspiciousCount = items.filter(i => i.suspicious).length
    this.setData({
      items,
      totalCount: items.length,
      suspiciousCount
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const newItems = this.data.items.filter(i => i.id !== id)
    this._refresh(newItems)
  },

  onAddManual() {
    wx.showToast({ title: '请回主页手动输入', icon: 'none' })
    // 简化：手动补充走主页输入框,不在确认页弹输入框
  },

  onRetake() {
    // 直接返回主页重新拍
    wx.navigateBack()
  },

  onConfirm() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '没有内容可添加', icon: 'none' })
      return
    }
    const app = getApp()
    app.globalData.pendingOcrResult = {
      items: null,
      confirmed: this.data.items.map(it => ({ content: it.content, type: it.type }))
    }
    wx.navigateBack()
  }
})
