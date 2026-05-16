// pages/dictation/finished/index.js
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

  onPhotoGrade() {
    wx.navigateTo({ url: '/pages/dictation/grading/index' })
  },

  onManualCheck() {
    wx.navigateTo({ url: '/pages/dictation/manual-check/index' })
  }
})
