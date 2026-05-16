// pages/dictation/result/index.js
Page({
  data: {
    score: { correct: 0, total: 0, rate: 0 },
    items: [],
    rateText: '0',
    wrongCount: 0
  },

  onLoad() {
    const app = getApp()
    const r = app.globalData.currentResult
    if (!r) {
      wx.showToast({ title: '没有判分结果', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    const wrongCount = (r.items || []).filter(it => !it.isCorrect).length
    this.setData({
      score: r.score || { correct: 0, total: 0, rate: 0 },
      items: r.items || [],
      rateText: Math.round((r.score && r.score.rate || 0) * 100).toString(),
      wrongCount
    })
  },

  onViewNotebook() {
    wx.reLaunch({ url: '/pages/dictation/notebook/index' })
  },

  onRetry() {
    // 清掉当前听写，主页就不会自动填充
    const app = getApp()
    app.globalData.currentDictation = null
    app.globalData.currentResult = null
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
