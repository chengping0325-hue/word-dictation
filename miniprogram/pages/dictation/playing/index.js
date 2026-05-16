// pages/dictation/playing/index.js
//
// Phase 2 阶段：用 setTimeout 模拟 TTS 朗读。每"读一次"耗 1.5 秒。
// Phase 3 阶段把 simulateRead() 替换成 tts-service.generateSpeech + playAudio。
//
// 状态机：
//   - cancelled：用户确认退出 / 页面卸载，整个循环停止
//   - replayFlag：用户按"重听"，当前条目从第 1 次重读
//   - skipFlag：用户按"下一个"，跳过剩余读次和间隔，进入下一条
//   - isPaused：用户按"暂停"，循环冻结直到再按"继续"
const { getTypeLabel } = require('../../../services/type-detector')

const SIMULATED_READ_MS = 1500   // Phase 2 假装"读一次"的时长

Page({
  data: {
    list: [],
    total: 0,
    currentIndex: 0,
    currentType: '',
    typeLabel: '',
    readCount: 2,
    interval: 5,
    readCurrent: 1,           // 1-based 当前是第几次朗读
    isPaused: false,
    isWaitingInterval: false, // 在等间隔时间
    isPlaying: false,         // 正在"播放"中
    progressBars: [],
    readDots: []
  },

  // 实例级状态（不放 setData 里避免重渲染）
  _cancelled: false,
  _replayFlag: false,
  _skipFlag: false,
  _sleepTimer: null,
  _sleepResolve: null,

  onLoad() {
    const app = getApp()
    const cd = app.globalData.currentDictation
    if (!cd || !Array.isArray(cd.list) || cd.list.length === 0) {
      wx.showToast({ title: '没有听写内容', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }

    const total = cd.list.length
    const readDots = Array.from({ length: cd.readCount }, () => false)
    this.setData({
      list: cd.list,
      total,
      readCount: cd.readCount,
      interval: cd.interval,
      progressBars: this._buildProgressBars(0, total),
      readDots
    })

    this._cancelled = false
    this._replayFlag = false
    this._skipFlag = false

    // 启动循环（不 await，让 onLoad 立即返回）
    this._runLoop().catch(err => {
      console.error('[Playing] loop error:', err)
    })
  },

  onUnload() {
    this._cancelled = true
    this._abortSleep()
  },

  // ── 主循环 ──
  async _runLoop() {
    while (!this._cancelled && this.data.currentIndex < this.data.total) {
      const i = this.data.currentIndex
      this._updateForItem(i)
      await this._playReads()
      if (this._cancelled) return

      // 间隔等待（最后一条不等）
      if (i < this.data.total - 1) {
        this.setData({ isWaitingInterval: true })
        const intervalResult = await this._waitIntervalCancellable(this.data.interval * 1000)
        this.setData({ isWaitingInterval: false })
        if (this._cancelled) return
        if (intervalResult === 'replay') {
          // 间隔期内按"重听"：原地重做当前条目
          continue
        }
        // 'skip' 或 'completed' 都直接前进
      }

      if (this._cancelled) return
      this.setData({
        currentIndex: i + 1,
        progressBars: this._buildProgressBars(i + 1, this.data.total)
      })
    }

    if (!this._cancelled) {
      wx.redirectTo({ url: '/pages/dictation/finished/index' })
    }
  },

  async _playReads() {
    let r = 1
    while (r <= this.data.readCount && !this._cancelled && !this._skipFlag) {
      if (this._replayFlag) { this._replayFlag = false; r = 1; continue }

      // 暂停轮询
      while (this.data.isPaused && !this._cancelled && !this._skipFlag && !this._replayFlag) {
        await this._sleep(80)
      }
      if (this._cancelled || this._skipFlag) break
      if (this._replayFlag) continue

      this.setData({
        readCurrent: r,
        isPlaying: true,
        readDots: this._buildReadDots(r, this.data.readCount)
      })

      await this._cancellableSleep(SIMULATED_READ_MS)

      this.setData({ isPlaying: false })

      if (this._cancelled || this._skipFlag) break
      if (this._replayFlag) continue
      // 如果暂停期间 abortSleep 被调用过，isPaused 依然为 true，外层会卡住直到 resume，然后重做当前 r
      if (this.data.isPaused) continue

      r++
    }
    this._skipFlag = false
  },

  // 间隔等待，可被 replay/skip/cancel/pause 打断
  async _waitIntervalCancellable(ms) {
    // 暂停时先等
    while (this.data.isPaused && !this._cancelled) {
      await this._sleep(80)
    }
    if (this._cancelled) return 'cancelled'

    await this._cancellableSleep(ms)

    if (this._cancelled) return 'cancelled'
    if (this._replayFlag) { this._replayFlag = false; return 'replay' }
    if (this._skipFlag) { this._skipFlag = false; return 'skip' }
    return 'completed'
  },

  // ── 工具函数 ──
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  _cancellableSleep(ms) {
    return new Promise(resolve => {
      this._sleepResolve = resolve
      this._sleepTimer = setTimeout(() => {
        this._sleepTimer = null
        this._sleepResolve = null
        resolve()
      }, ms)
    })
  },

  _abortSleep() {
    if (this._sleepTimer) {
      clearTimeout(this._sleepTimer)
      this._sleepTimer = null
    }
    if (this._sleepResolve) {
      const r = this._sleepResolve
      this._sleepResolve = null
      r()
    }
  },

  _updateForItem(i) {
    const item = this.data.list[i]
    if (!item) return
    this.setData({
      currentType: item.type,
      typeLabel: getTypeLabel(item.type),
      readCurrent: 1,
      readDots: this._buildReadDots(1, this.data.readCount),
      progressBars: this._buildProgressBars(i, this.data.total)
    })
  },

  _buildProgressBars(activeIndex, total) {
    return Array.from({ length: total }, (_, i) => {
      if (i < activeIndex) return 'done'
      if (i === activeIndex) return 'active'
      return ''
    })
  },

  _buildReadDots(activeRead, total) {
    return Array.from({ length: total }, (_, i) => i < activeRead)
  },

  // ── 控件回调 ──
  onReplay() {
    this._replayFlag = true
    this._abortSleep()
  },

  onTogglePause() {
    const wasPaused = this.data.isPaused
    this.setData({ isPaused: !wasPaused })
    if (!wasPaused) {
      // 进入暂停态：打断当前 sleep，让循环回到 pause-polling
      this._abortSleep()
    }
    // 进入继续态：循环里的 pause-polling 会在下一次 _sleep(80) 后退出，无需做额外事
  },

  onNext() {
    this._skipFlag = true
    this._abortSleep()
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
          this._cancelled = true
          this._abortSleep()
          wx.navigateBack()
        }
      }
    })
  }
})
