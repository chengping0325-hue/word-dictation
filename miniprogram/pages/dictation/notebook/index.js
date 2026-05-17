// 单词本 - Phase 1 静态版（Phase 5 会改成读云数据库）
// "重新听写"按钮：把该次 session 的全部条目（不论对错）作为新清单回主页
Page({
  data: {
    filter: 'all', // 'all' | 'wrong'
    sessions: [
      {
        id: 's1',
        date: '2026年5月16日',
        summary: '4 / 6 正确',
        items: [
          { id: 'a1', content: 'apple', type: 'en_word', isCorrect: true },
          { id: 'a2', content: '苹果', type: 'cn_word', isCorrect: true },
          { id: 'a3', content: 'orange', type: 'en_word', isCorrect: false, userAnswer: 'oraneg' },
          { id: 'a4', content: 'I like apples very much.', type: 'en_sentence', isCorrect: false, userAnswer: 'I like aples very much', wrongHint: 'aples → apples' },
          { id: 'a5', content: '床前明月光,疑是地上霜', type: 'cn_sentence', isCorrect: true },
          { id: 'a6', content: 'grape', type: 'en_word', isCorrect: true }
        ]
      },
      {
        id: 's2',
        date: '2026年5月15日',
        summary: '5 / 5 全对 🎉',
        items: [
          { id: 'b1', content: '床前明月光。', type: 'cn_sentence', isCorrect: true },
          { id: 'b2', content: 'school', type: 'en_word', isCorrect: true },
          { id: 'b3', content: 'friend', type: 'en_word', isCorrect: true }
        ]
      }
    ]
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) return
    this.setData({ filter })
  },

  // 项 8：点该次卡片底部的"重新听写"按钮
  // 行为：把该次 session 的所有条目（不论 isCorrect）作为新清单，reLaunch 到主页
  onReDictateSession(e) {
    const sessionId = e.currentTarget.dataset.sessionId
    const session = this.data.sessions.find(s => s.id === sessionId)
    if (!session) return

    const list = (session.items || []).map(it => ({
      id: `re-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: it.content,
      type: it.type
    }))
    if (list.length === 0) return

    const app = getApp()
    app.globalData.currentDictation = {
      list,
      readCount: 2,
      interval: 5
    }
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
