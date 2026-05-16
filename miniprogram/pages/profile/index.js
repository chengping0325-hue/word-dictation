const { getSessions } = require('../../utils/db')

Page({
  data: {
    avatarUrl: '/assets/default-avatar.png',
    nickname: '微信用户',
    sessions: []
  },

  onLoad() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '/assets/default-avatar.png',
        nickname: userInfo.nickName || '微信用户'
      })
    }
    this.loadSessions()
  },

  onShow() {
    this.loadSessions()
  },

  async loadSessions() {
    try {
      const res = await getSessions(20)
      const sessions = res.data.map(s => ({
        ...s,
        dateStr: this.formatDate(s.createdAt)
      }))
      this.setData({ sessions })
    } catch (e) {
      console.error('加载记录失败', e)
    }
  },

  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }
})
