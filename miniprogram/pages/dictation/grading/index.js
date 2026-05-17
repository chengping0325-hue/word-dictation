// pages/dictation/grading/index.js
// Phase 4：真实 OCR + 判分
// URL 参数 fileID = 已上传到云存储的答卷图片
const ocr = require('../../../services/ocr-service')
const { gradeSession } = require('../../../services/grading-service')

Page({
  data: {
    steps: [
      { label: '图片上传完成', state: 'done' },
      { label: '识别手写内容(含句子)...', state: 'active' },
      { label: '逐词对比判分', state: 'pending' }
    ]
  },

  onLoad(query) {
    const app = getApp()
    const cd = app.globalData.currentDictation
    if (!cd || !Array.isArray(cd.list) || cd.list.length === 0) {
      wx.showToast({ title: '没有听写记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    const fileID = query && query.fileID ? decodeURIComponent(query.fileID) : ''
    if (!fileID) {
      wx.showToast({ title: '缺少图片', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }

    this._run(fileID, cd.list)
  },

  async _run(fileID, list) {
    try {
      // 步骤 2: OCR
      const { items: ocrTexts } = await ocr.recognize(fileID)

      this.setData({
        steps: [
          { label: '图片上传完成', state: 'done' },
          { label: '识别手写内容(含句子)', state: 'done' },
          { label: '逐词对比判分', state: 'active' }
        ]
      })

      // 步骤 3: 判分
      const result = gradeSession(list, ocrTexts)
      result.mode = 'ocr'

      const app = getApp()
      app.globalData.currentResult = result
      wx.redirectTo({ url: '/pages/dictation/result/index' })
    } catch (err) {
      console.error('[grading] failed:', err && err.message)
      wx.hideLoading()
      wx.showModal({
        title: '识别失败',
        content: (err && err.message) || '换用手动核对?',
        confirmText: '手动核对',
        cancelText: '返回',
        confirmColor: '#2563EB',
        success: (r) => {
          if (r.confirm) {
            wx.redirectTo({ url: '/pages/dictation/manual-check/index' })
          } else {
            wx.navigateBack()
          }
        }
      })
    }
  }
})
