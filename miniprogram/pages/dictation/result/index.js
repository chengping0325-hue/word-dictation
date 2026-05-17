// pages/dictation/result/index.js
// Phase 4：onLoad 时把 currentResult 写入云数据库（仅首次进入；redirectTo 进入算首次）
const { callCloudFunction } = require('../../../utils/cloud')
const cache = require('../../../utils/cache')

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

    // 保存到云数据库（只触发一次：用 result.savedToCloud 标记防重）
    if (!r.savedToCloud) {
      r.savedToCloud = true
      const cd = app.globalData.currentDictation || {}
      callCloudFunction('session', {
        action: 'save',
        data: {
          mode: r.mode || 'ocr',
          settings: {
            readCount: cd.readCount || 2,
            interval: cd.interval || 5
          },
          score: r.score,
          items: r.items
        }
      }).then(res => {
        if (!res || !res.success) {
          console.warn('[result] 保存 session 失败:', res && res.error)
        }
      }).catch(err => {
        console.error('[result] 保存 session 异常:', err && err.message)
        // 不打断用户：保存失败也让结果显示出来，最多单词本里少一条
      })
    }
  },

  onViewNotebook() {
    wx.reLaunch({ url: '/pages/dictation/notebook/index' })
  },

  onRetry() {
    // 清掉当前听写 + 本地缓存的清单，回主页变成空清单
    const app = getApp()
    app.globalData.currentDictation = null
    app.globalData.currentResult = null
    cache.clearPendingList()
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
