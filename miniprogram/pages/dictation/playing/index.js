// 听写中 - Phase 1 静态版（暂无 TTS，按钮可点但不触发实际播放）
Page({
  data: {
    total: 6,
    currentIndex: 2, // 第 3 条（0-based）
    currentType: 'en_sentence',
    typeLabel: 'EN 句',
    readCurrent: 1,
    readTotal: 2,
    isPaused: false,
    progressBars: []
  },

  onLoad() {
    // 生成进度条数组（已完成/当前/未完成）
    const total = this.data.total
    const current = this.data.currentIndex
    const progressBars = Array.from({ length: total }).map((_, i) => {
      if (i < current) return 'done'
      if (i === current) return 'active'
      return ''
    })
    this.setData({ progressBars })
  },

  onBack() {
    wx.showModal({
      title: '确定要退出听写吗?',
      content: `当前已听写到第 ${this.data.currentIndex + 1} 条 / 共 ${this.data.total} 条\n未完成的进度不会保存`,
      confirmText: '确认退出',
      cancelText: '继续听写',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  },

  onReplay() {
    // Phase 3 实现
  },
  onTogglePause() {
    this.setData({ isPaused: !this.data.isPaused })
  },
  onNext() {
    // Phase 1 占位：跳到听写完成页（实际逻辑在 Phase 2 / 3）
    wx.redirectTo({ url: '/pages/dictation/finished/index' })
  }
})
