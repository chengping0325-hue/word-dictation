// AI 判分中 - Phase 1 静态版（占位 loading 页）
Page({
  data: {
    steps: [
      { label: '图片上传完成', state: 'done' },
      { label: '识别手写内容(含句子)...', state: 'active' },
      { label: '逐词对比判分', state: 'pending' }
    ]
  },

  // Phase 1 给一个占位入口跳到结果页，方便手动验证视觉
  onSkipToResult() {
    wx.redirectTo({ url: '/pages/dictation/result/index' })
  }
})
