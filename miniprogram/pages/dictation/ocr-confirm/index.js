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

  // 点击条目 → 弹输入框编辑
  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const target = this.data.items.find(i => i.id === id)
    if (!target) return
    wx.showModal({
      title: '修改内容',
      editable: true,                       // 关键:让 modal 变成输入框
      placeholderText: '请输入正确的内容',
      content: target.content,
      confirmText: '保存',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        const newText = (res.content || '').trim()
        if (newText.length === 0) {
          wx.showToast({ title: '内容不能为空', icon: 'none' })
          return
        }
        if (newText.length > 200) {
          wx.showToast({ title: '内容过长', icon: 'none' })
          return
        }
        const { detectType } = require('../../../services/type-detector')
        const newItems = this.data.items.map(i =>
          i.id === id ? { ...i, content: newText, type: detectType(newText), suspicious: false } : i
        )
        this._refresh(newItems)
      }
    })
  },

  onAddManual() {
    wx.showModal({
      title: '补充内容',
      editable: true,
      placeholderText: '输入要添加的单词或句子',
      content: '',
      confirmText: '添加',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        const text = (res.content || '').trim()
        if (text.length === 0) return
        if (text.length > 200) {
          wx.showToast({ title: '内容过长', icon: 'none' })
          return
        }
        const { detectType } = require('../../../services/type-detector')
        const newItem = {
          id: `manual-${Date.now()}`,
          content: text,
          type: detectType(text),
          suspicious: false
        }
        this._refresh(this.data.items.concat([newItem]))
      }
    })
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
