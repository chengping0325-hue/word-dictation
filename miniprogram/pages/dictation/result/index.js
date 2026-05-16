// 判分结果 - Phase 1 静态版
Page({
  data: {
    score: { correct: 4, total: 6, rate: 0.67 },
    items: [
      { id: 1, content: 'apple', type: 'en_word', isCorrect: true },
      { id: 2, content: '苹果', type: 'cn_word', isCorrect: true },
      { id: 3, content: 'orange', type: 'en_word', isCorrect: false, userAnswer: 'oraneg' },
      { id: 4, content: 'I like apples very much.', type: 'en_sentence', isCorrect: false,
        wordDiff: [
          { word: 'I', ok: true },
          { word: 'like', ok: true },
          { word: 'aples', ok: false, expected: 'apples' },
          { word: 'very', ok: true },
          { word: 'much', ok: true }
        ],
        userAnswer: 'aples', correction: 'apples' },
      { id: 5, content: '床前明月光,疑是地上霜', type: 'cn_sentence', isCorrect: true },
      { id: 6, content: 'grape', type: 'en_word', isCorrect: true }
    ],
    suspectCount: 2
  },

  onViewNotebook() {
    wx.reLaunch({ url: '/pages/dictation/notebook/index' })
  },
  onRetry() {
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
