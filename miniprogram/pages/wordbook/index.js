const { getSessions } = require('../../utils/db')

Page({
  data: {
    sessions: [],
    loading: true
  },

  onShow() {
    this.loadSessions()
  },

  async loadSessions() {
    this.setData({ loading: true })
    try {
      const res = await getSessions(50)
      const sessions = (res.data || []).map(this.enrichSession)
      this.setData({ sessions, loading: false })
    } catch (e) {
      console.error('加载单词本失败', e)
      this.setData({ loading: false })
    }
  },

  enrichSession(s) {
    return {
      ...s,
      dateStr: formatDate(s.createdAt),
      scoreColor: s.score === s.total ? '#34C759'
                : s.score / s.total >= 0.6 ? '#FF9500'
                : '#FF3B30'
    }
  }
})

function formatDate(d) {
  const date = new Date(d)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const hh = String(date.getHours()).padStart(2,'0')
  const mm = String(date.getMinutes()).padStart(2,'0')
  if (isToday) return `今天 ${hh}:${mm}`
  if (isYesterday) return `昨天 ${hh}:${mm}`
  return `${date.getMonth()+1}/${date.getDate()} ${hh}:${mm}`
}
