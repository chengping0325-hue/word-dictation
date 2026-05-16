// 听写主页 - Phase 1 静态版（无业务逻辑，假数据 + 路由跳转）
Page({
  data: {
    inputValue: '',
    pendingList: [
      { id: 1, content: 'apple', type: 'en_word' },
      { id: 2, content: '苹果', type: 'cn_word' },
      { id: 3, content: 'banana', type: 'en_word' },
      { id: 4, content: 'I like apples very much.', type: 'en_sentence' },
      { id: 5, content: '床前明月光,疑是地上霜。', type: 'cn_sentence' },
      { id: 6, content: 'grape', type: 'en_word' }
    ],
    settings: {
      readCount: 2,
      interval: 5
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  onAdd() {
    // Phase 2 实现
  },

  onClearAll() {
    // Phase 2 实现
  },

  onDelete() {
    // Phase 2 实现
  },

  onCameraTap() {
    // Phase 1 直接跳到 OCR 确认页（假装拍照成功）
    wx.navigateTo({ url: '/pages/dictation/ocr-confirm/index' })
  },

  onStepperMinus() {
    // Phase 2 实现
  },
  onStepperPlus() {
    // Phase 2 实现
  },

  onStart() {
    wx.navigateTo({ url: '/pages/dictation/playing/index' })
  }
})
