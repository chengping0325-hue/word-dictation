// 听写完成 - Phase 1 静态版
Page({
  data: {
    total: 6
  },

  onPhotoGrade() {
    wx.navigateTo({ url: '/pages/dictation/grading/index' })
  },
  onManualCheck() {
    wx.navigateTo({ url: '/pages/dictation/manual-check/index' })
  }
})
