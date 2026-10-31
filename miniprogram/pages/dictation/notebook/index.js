// 单词本 — Phase 5：读云数据库真实数据
// 数据流：onShow 调 db.collection('sessions').orderBy('createdAt', desc).limit(20).get()
// 转换：raw sessions → [{ id, date, summary, items: [...] }]
const { formatSessionDate } = require('../../../utils/time')

const PAGE_LIMIT = 20

// 滚动内容比容器多出的高度（rpx）。作用：让内容永远略微超过可视区。
//
// 两个原因都需要它：
//   1. iOS 的 UIScrollView 只有 contentSize > bounds 时才可滚动，
//      内容不足一屏就没有回弹（bounces）。
//   2. enhanced 模式下 scroll-view 在「空滚动区域」仍会挂载滚动监听
//      并吞掉 touch 事件，子元素的 bindtap 会失效 ——
//      单词本记录少的时候，「全部记录 / 仅错词」分段控件就点不动。
//
// 这个值和内容区的 padding-bottom 是两套独立机制：
// min-height 撑起的是内容整体高度，padding 是内容下方的留白。
// 两者叠加会让内容少时底部出现大片空白，所以这里要小。
const BOUNCE_EXTRA_RPX = 60

Page({
  data: {
    filter: 'all',
    sessions: [],
    loading: false,
    loadError: false,
    statusBarHeight: 20,
    navBarHeight: 44,
    scrollMinHeight: 0        // 内容区最小高度(px)，见 _measureScrollMinHeight
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync()
    const statusBarHeight = windowInfo.statusBarHeight || 20
    let navBarHeight = 44

    if (wx.getMenuButtonBoundingClientRect) {
      const menuButton = wx.getMenuButtonBoundingClientRect()
      if (menuButton && menuButton.top && menuButton.height) {
        navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
      }
    }

    this._windowWidth = windowInfo.windowWidth || 375
    this.setData({ statusBarHeight, navBarHeight })
  },

  onReady() {
    // 布局就绪后测量滚动容器高度，撑出恒定的回弹余量
    this._measureScrollMinHeight()
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

  /**
   * 让内容区始终比滚动容器高出 BOUNCE_EXTRA_RPX，
   * 这样即使内容不足一屏（还没有听写记录时），也能拉动并回弹，
   * 同时避免 enhanced 模式下 scroll-view 吞掉子元素的 tap 事件。
   *
   * 用 JS 实测而不是写百分比：scroll-view 的直接子元素用百分比高度
   * 在部分 WebView 下解析基准不确定，实测值最可靠。
   */
  _measureScrollMinHeight() {
    wx.createSelectorQuery()
      .in(this)
      .select('.notebook-scroll')
      .boundingClientRect(rect => {
        if (!rect || !rect.height) return
        const extraPx = BOUNCE_EXTRA_RPX * (this._windowWidth || 375) / 750
        this.setData({ scrollMinHeight: Math.round(rect.height + extraPx) })
      })
      .exec()
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
  if (item.userAnswer) return `写成 ${item.userAnswer} → ${item.content}`
  return '未识别到'
}
