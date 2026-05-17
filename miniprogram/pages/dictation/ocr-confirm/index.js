// pages/dictation/ocr-confirm/index.js
// 入：globalData.pendingOcrResult.items = [{ content, type, suspicious }]
// 出：globalData.pendingOcrResult.confirmed = [{ content, type }] → 主页 onShow 合入
const { detectType } = require('../../../services/type-detector')
const ocr = require('../../../services/ocr-service')
const { uploadToCloudStorage } = require('../../../utils/cloud')

// 判定 OCR 识别结果是否可疑(跟主页同步逻辑)
function looksSuspicious(text) {
  if (!text || text.length < 1) return true
  if (/[0-9]/.test(text)) return true
  if (/[#&*~^@<>{}[\]\\|]/.test(text)) return true
  if (!/[一-龥a-zA-Z]/.test(text)) return true
  return false
}

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

  // 重拍:跟主页相机图标同样的流程,但完成后直接覆盖本页 items(不返回主页)
  onRetake() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        wx.showLoading({ title: '识别中…', mask: true })
        uploadToCloudStorage(filePath, 'ocr-input')
          .then(fileID => ocr.recognize(fileID))
          .then(({ items }) => {
            wx.hideLoading()
            const refreshed = items.map((text, i) => ({
              id: `ocr-${Date.now()}-${i}`,
              content: text,
              type: detectType(text),
              suspicious: looksSuspicious(text)
            }))
            this._refresh(refreshed)
          })
          .catch(err => {
            wx.hideLoading()
            console.error('[ocr-confirm] 重拍识别失败:', err && err.message)
            wx.showToast({ title: (err && err.message) || '识别失败', icon: 'none', duration: 2200 })
          })
      },
      fail: () => {
        // 用户取消,静默
      }
    })
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
