// pages/dictation/finished/index.js
const { uploadToCloudStorage } = require('../../../utils/cloud')

Page({
  data: {
    total: 0
  },

  onLoad() {
    const app = getApp()
    const cd = app.globalData.currentDictation
    const total = (cd && Array.isArray(cd.list)) ? cd.list.length : 0
    this.setData({ total })
  },

  // 拍照判分（Phase 4 真实流程）
  onPhotoGrade() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        wx.showLoading({ title: '上传中…', mask: true })
        uploadToCloudStorage(filePath, 'ocr-grade')
          .then(fileID => {
            wx.hideLoading()
            // 把 fileID 通过 URL 传给 grading 页（grading 页负责后续 OCR + 判分）
            wx.navigateTo({
              url: `/pages/dictation/grading/index?fileID=${encodeURIComponent(fileID)}`
            })
          })
          .catch(err => {
            wx.hideLoading()
            console.error('[finished] 上传失败:', err && err.message)
            wx.showModal({
              title: '上传失败',
              content: '换用手动核对?',
              confirmText: '好的',
              cancelText: '重试',
              success: (r) => {
                if (r.confirm) {
                  wx.navigateTo({ url: '/pages/dictation/manual-check/index' })
                }
              }
            })
          })
      }
    })
  },

  onManualCheck() {
    wx.navigateTo({ url: '/pages/dictation/manual-check/index' })
  },

  // 返回上一页(听写中)→ 实际会跳过 playing 直接回主页(因为 playing 用 redirectTo 跳过来)
  // 用户语义:放弃判分,回主页
  onBack() {
    wx.navigateBack({
      fail: () => {
        // 如果不在栈里(冷启动直接进来)就回主页
        wx.reLaunch({ url: '/pages/dictation/index/index' })
      }
    })
  }
})
