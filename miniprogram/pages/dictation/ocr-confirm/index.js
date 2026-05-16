// OCR 识别确认 - Phase 1 静态版
Page({
  data: {
    totalCount: 5,
    suspiciousCount: 2,
    items: [
      { id: 1, content: 'apple', type: 'en_word', suspicious: false },
      { id: 2, content: '苹果', type: 'cn_word', suspicious: false },
      { id: 3, content: 'I like aples vry mch.', type: 'en_sentence', suspicious: true },
      { id: 4, content: '床前明月光,疑是地上霜。', type: 'cn_sentence', suspicious: false },
      { id: 5, content: 'grappe', type: 'en_word', suspicious: true }
    ]
  },

  onRetake() {
    wx.showToast({ title: 'Phase 4 实现', icon: 'none' })
  },

  onDelete() {
    // Phase 4 实现
  },

  onAddManual() {
    // Phase 4 实现
  },

  onConfirm() {
    wx.navigateBack()
  }
})
