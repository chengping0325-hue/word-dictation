// pages/dictation/result/index.js
// Phase 4+5：onLoad 首次保存到云数据库;支持手动切换条目对错(本地+云同步)
const { callCloudFunction } = require('../../../utils/cloud')
const cache = require('../../../utils/cache')

Page({
  data: {
    score: { correct: 0, total: 0, rate: 0 },
    items: [],
    rateText: '0',
    wrongCount: 0
  },

  // 实例级 debounce timer
  _syncTimer: null,

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

    // 保存到云数据库(只触发一次:用 r.savedToCloud 防重)
    // 拿到 _id 后存到 r.sessionId,供后续 onToggleCorrect 调 update
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
        if (res && res.success && res._id) {
          r.sessionId = res._id
        } else {
          console.warn('[result] 保存 session 失败:', res && res.error)
        }
      }).catch(err => {
        console.error('[result] 保存 session 异常:', err && err.message)
      })
    }
  },

  // 手动切换某条对错(用户修正 OCR 误判)
  onToggleCorrect(e) {
    const index = e.currentTarget.dataset.index
    if (index == null) return
    const items = this.data.items.slice()
    const old = items[index]
    if (!old) return
    items[index] = Object.assign({}, old, { isCorrect: !old.isCorrect })

    const correct = items.filter(i => i.isCorrect).length
    const total = items.length
    const rate = total > 0 ? correct / total : 0
    const wrongCount = items.filter(i => !i.isCorrect).length
    const newScore = { correct, total, rate }

    this.setData({
      items,
      score: newScore,
      rateText: Math.round(rate * 100).toString(),
      wrongCount
    })

    // 同步到 globalData(影响单词本/重新听写 等下游)
    const app = getApp()
    if (app.globalData.currentResult) {
      app.globalData.currentResult.items = items
      app.globalData.currentResult.score = newScore
    }

    // debounce 同步到云数据库(用户可能快速连点多次)
    this._scheduleSync()
  },

  _scheduleSync() {
    if (this._syncTimer) clearTimeout(this._syncTimer)
    this._syncTimer = setTimeout(() => {
      this._syncTimer = null
      const app = getApp()
      const r = app.globalData.currentResult
      if (!r || !r.sessionId) {
        // 还没拿到 sessionId(保存中或失败)→ 再等一会儿重试一次
        if (r && !r.sessionId) setTimeout(() => this._scheduleSync(), 800)
        return
      }
      callCloudFunction('session', {
        action: 'update',
        data: {
          _id: r.sessionId,
          score: r.score,
          items: r.items
        }
      }).then(res => {
        if (!res || !res.success) {
          console.warn('[result] 同步修改失败:', res && res.error)
        }
      }).catch(err => {
        console.error('[result] 同步修改异常:', err && err.message)
      })
    }, 500)
  },

  onUnload() {
    // 离开前如果还有待同步,立刻 flush 一次(避免修改丢失)
    if (this._syncTimer) {
      clearTimeout(this._syncTimer)
      this._syncTimer = null
      const app = getApp()
      const r = app.globalData.currentResult
      if (r && r.sessionId) {
        callCloudFunction('session', {
          action: 'update',
          data: {
            _id: r.sessionId,
            score: r.score,
            items: r.items
          }
        }).catch(() => {})
      }
    }
  },

  onViewNotebook() {
    wx.reLaunch({ url: '/pages/dictation/notebook/index' })
  },

  // 全部条目作为新清单 → reLaunch 主页
  onRetry() {
    this._reDictate(this.data.items)
  },

  // 只把错的条目作为新清单
  onRetryWrong() {
    if (this.data.wrongCount === 0) return
    const wrongItems = this.data.items.filter(it => !it.isCorrect)
    this._reDictate(wrongItems)
  },

  _reDictate(sourceItems) {
    const list = (sourceItems || []).map(it => ({
      id: `re-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: it.content,
      type: it.type
    }))
    if (list.length === 0) {
      wx.showToast({ title: '没有可听写的内容', icon: 'none' })
      return
    }
    const app = getApp()
    app.globalData.currentDictation = {
      list,
      readCount: 2,
      interval: 5
    }
    app.globalData.currentResult = null
    cache.clearPendingList()
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
