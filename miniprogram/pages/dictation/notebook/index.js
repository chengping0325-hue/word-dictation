// 单词本 - Phase 1 静态版
Page({
  data: {
    filter: 'all', // 'all' | 'wrong'
    sessions: [
      {
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
    this.setData({ filter })
  },

  onReDictateWrong() {
    // Phase 5 实现
    wx.showToast({ title: 'Phase 5 实现', icon: 'none' })
  }
})
