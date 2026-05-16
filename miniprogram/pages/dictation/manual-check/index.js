// 手动核对 - Phase 1 静态版
Page({
  data: {
    currentIndex: 2,
    total: 6,
    currentItem: {
      content: 'I like apples very much.',
      type: 'en_sentence'
    },
    typeLabel: 'EN 句',
    checked: [
      { id: 1, content: 'apple', type: 'en_word', isCorrect: true },
      { id: 2, content: 'banana', type: 'en_word', isCorrect: false }
    ]
  },

  onCorrect() {
    // Phase 2 实现
    wx.showToast({ title: 'Phase 2 实现', icon: 'none' })
  },
  onWrong() {
    wx.showToast({ title: 'Phase 2 实现', icon: 'none' })
  },
  onSkip() {
    // Phase 2 实现
  },

  // Phase 1 占位入口
  onJumpToResult() {
    wx.redirectTo({ url: '/pages/dictation/result/index' })
  }
})
