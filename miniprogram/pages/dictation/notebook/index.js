// 单词本 — Phase 5：读云数据库真实数据
// 数据流：onShow 调 db.collection('sessions').orderBy('createdAt', desc).limit(20).get()
// 转换：raw sessions → [{ id, date, summary, items: [...] }]
const { formatSessionDate } = require('../../../utils/time')

const PAGE_LIMIT = 20

Page({
  data: {
    filter: 'all',
    sessions: [],
    loading: false,
    loadError: false
  },

  // 每次回到此 tab 都刷新（用户做完听写 → 跳 result → "查看单词本" reLaunch 过来）
  onShow() {
    this._loadSessions()
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.filter) return
    this.setData({ filter })
  },

  async _loadSessions() {
    this.setData({ loading: true, loadError: false })
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('sessions')
        .orderBy('createdAt', 'desc')
        .limit(PAGE_LIMIT)
        .get()

      const sessions = (data || []).map(transformSession)
      this.setData({ sessions, loading: false, loadError: false })
    } catch (err) {
      console.error('[notebook] 加载 sessions 失败:', err && err.errMsg)
      this.setData({ loading: false, loadError: true })
      wx.showToast({ title: '加载失败,请重试', icon: 'none' })
    }
  },

  onRetryLoad() {
    this._loadSessions()
  },

  // 卡片底部"重新听写" / "重新听写错词"
  // - 全部记录 Tab → 用 session.items 全部条目
  // - 仅错词 Tab   → 只用 !isCorrect 的条目
  onReDictateSession(e) {
    const sessionId = e.currentTarget.dataset.sessionId
    const session = this.data.sessions.find(s => s.id === sessionId)
    if (!session) return

    let source = session.items || []
    if (this.data.filter === 'wrong') {
      source = source.filter(it => !it.isCorrect)
    }

    if (source.length === 0) {
      wx.showToast({ title: '没有可听写的内容', icon: 'none' })
      return
    }

    const list = source.map(it => ({
      id: `re-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: it.content,
      type: it.type
    }))

    const app = getApp()
    app.globalData.currentDictation = {
      list,
      readCount: 2,
      interval: 5
    }
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})

// 把云数据库的一条 session 转成 UI 用的结构
function transformSession(raw) {
  const score = raw.score || { correct: 0, total: 0 }
  const isPerfect = score.total > 0 && score.correct === score.total
  const summary = isPerfect
    ? `${score.correct} / ${score.total} 全对 🎉`
    : `${score.correct} / ${score.total} 正确`

  const items = (raw.items || []).map((it, i) => ({
    id: `${raw._id}-${i}`,
    content: it.content,
    type: it.type,
    isCorrect: !!it.isCorrect,
    userAnswer: it.userAnswer || null,
    // 单词本里展示的"错词提示"小字
    // 优先用 wordDiff 找第一个错词;否则用 userAnswer → content 的简单对比
    wrongHint: buildWrongHint(it)
  }))

  const hasWrong = items.some(it => !it.isCorrect)

  return {
    id: raw._id,
    date: formatSessionDate(raw.createdAt),
    summary,
    items,
    hasWrong
  }
}

function buildWrongHint(item) {
  if (item.isCorrect) return ''
  if (item.wordDiff && item.wordDiff.length > 0) {
    const wrong = item.wordDiff.find(w => !w.ok && w.expected)
    if (wrong) return `${wrong.word || '(漏写)'} → ${wrong.expected}`
  }
  if (item.userAnswer) return `写成 ${item.userAnswer} → ${item.content}`
  return '未识别到'
}
