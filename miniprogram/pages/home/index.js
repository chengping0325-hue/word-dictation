Page({
  data: {
    tools: [
      {
        id: 'dictation',
        name: '单词听写',
        desc: '中英文 · 单词与句子',
        icon: '🎧',
        badge: '推荐',
        badgeClass: 'hot',
        url: '/pages/dictation/index/index',
        disabled: false
      },
      {
        id: 'reading',
        name: '阅读打卡',
        desc: '读书计划与记录',
        icon: '📚',
        badge: '敬请期待',
        badgeClass: '',
        url: '/pages/soon/index',
        disabled: true
      }
    ]
  },

  onToolTap(e) {
    const tool = e.currentTarget.dataset.tool
    if (!tool || !tool.url) return
    wx.navigateTo({ url: tool.url })
  },

  onPlaceholderTap() {
    wx.navigateTo({ url: '/pages/soon/index' })
  }
})
