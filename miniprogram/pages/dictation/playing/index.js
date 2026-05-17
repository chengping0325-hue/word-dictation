// pages/dictation/playing/index.js
//
// Phase 3：用真实 TTS 替换 Phase 2 的 setTimeout 模拟。
// 状态机保留：cancelled / replayFlag / skipFlag / isPaused
//
// 关键变化：
//   - 进入每条 item 时调 tts.generateSpeech 预生成音频（音频缓存在 service 层）
//   - 每次"读一次"是 await tts.playAudio(audioUrl)
//   - 暂停/重听/下一个/退出 都调 tts.stopAudio() 中断当前播放
//   - 多次朗读之间等 200ms（PRD 5.3）
const tts = require('../../../services/tts-service')
const { getTypeLabel, getLang } = require('../../../services/type-detector')

Page({
  data: {
    list: [],
    total: 0,
    currentIndex: 0,
    currentType: '',
    typeLabel: '',
    readCount: 2,
    interval: 5,
    readCurrent: 1,
    isPaused: false,
    isWaitingInterval: false,
    isPlaying: false,
    isGenerating: false,      // 正在调云函数合成音频
    progressBars: [],
    readDots: []
  },

  // 实例级状态
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
    this.setData({
      list: cd.list,
      total,
      readCount: cd.readCount,
      interval: cd.interval,
      progressBars: this._buildProgressBars(0, total),
      readDots: this._buildReadDots(1, cd.readCount)
    })

    this._cancelled = false
    this._replayFlag = false
    this._skipFlag = false

    this._runLoop().catch(err => {
      console.error('[playing] loop error:', err)
    })
  },

  onShow() {
    // 项 11：拦截系统返回（iOS 侧滑、Android back、微信导航栏 ←）
    // 注意：wx.enableAlertBeforeUnload 弹的是系统级确认框（无法自定义文案颜色）
    // 这是小程序唯一能拦截系统返回的方式。我们的自定义弹窗（onBack）仅用于
    // 自定义导航栏的左上角圆形 ← 按钮。
    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({
        message: '退出后未完成的听写进度不会保存,确认离开?'
      })
    }
  },

  onHide() {
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload()
    }
  },

  onUnload() {
    this._cancelled = true
    tts.stopAudio()
    this._abortSleep()
    tts.clearCache()
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload()
    }
  },

  // ── 主循环 ──
  async _runLoop() {
    while (!this._cancelled && this.data.currentIndex < this.data.total) {
      const i = this.data.currentIndex
      this._updateForItem(i)

      // 预生成本条音频（云函数调用 + 写临时文件，约 1–2 秒）
      let audioUrl
      this.setData({ isGenerating: true, isPlaying: false })
      try {
        const cur = this.data.list[i]
        const lang = getLang(cur.type)
        const res = await tts.generateSpeech(cur.content, lang)
        audioUrl = res.audioUrl
      } catch (err) {
        this.setData({ isGenerating: false })
        if (this._cancelled) return
        // PRD 5.5：toast 提示，停在当前条目，等用户手动重听/下一个
        wx.showToast({ title: '朗读失败,请重试', icon: 'none', duration: 2000 })
        const action = await this._waitForUserAction()
        if (this._cancelled) return
        if (action === 'replay') { this._replayFlag = false; continue }
        if (action === 'skip') {
          this._skipFlag = false
          this.setData({
            currentIndex: i + 1,
            progressBars: this._buildProgressBars(i + 1, this.data.total)
          })
          continue
        }
        continue
      }
      this.setData({ isGenerating: false })

      if (this._cancelled) return

      await this._playReads(audioUrl)
      if (this._cancelled) return

      // 间隔等待（最后一条不等）
      if (i < this.data.total - 1) {
        this.setData({ isWaitingInterval: true })
        const intervalResult = await this._waitIntervalCancellable(this.data.interval * 1000)
        this.setData({ isWaitingInterval: false })
        if (this._cancelled) return
        if (intervalResult === 'replay') { continue }  // 间隔期内按"重听" → 原地重做本条
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

  async _playReads(audioUrl) {
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

      let endReason
      try {
        endReason = await tts.playAudio(audioUrl)
      } catch (err) {
        console.error('[playing] playAudio error:', err)
        wx.showToast({ title: '播放失败', icon: 'none' })
        endReason = 'error'
      }

      this.setData({ isPlaying: false })

      if (this._cancelled || this._skipFlag) break
      if (this._replayFlag) continue
      if (this.data.isPaused) continue  // 暂停中断，重做当前 r
      if (endReason === 'error') break

      r++
      if (r <= this.data.readCount) {
        // 两次朗读之间也按 settings.interval 等待(跟条目间隔一致)
        // 期间维持 isWaitingInterval 态,UI 显示"间隔等待中"
        this.setData({ isWaitingInterval: true })
        await this._cancellableSleep(this.data.interval * 1000)
        this.setData({ isWaitingInterval: false })
        if (this._cancelled || this._skipFlag) break
        if (this._replayFlag) continue
      }
    }
    this._skipFlag = false
  },

  async _waitIntervalCancellable(ms) {
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

  // 错误恢复用：等用户按重听或下一个
  async _waitForUserAction() {
    while (!this._cancelled && !this._replayFlag && !this._skipFlag) {
      await this._sleep(120)
    }
    if (this._cancelled) return 'cancelled'
    if (this._replayFlag) return 'replay'
    return 'skip'
  },

  // ── 工具 ──
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
    tts.stopAudio()
    this._abortSleep()
  },

  onTogglePause() {
    const wasPaused = this.data.isPaused
    this.setData({ isPaused: !wasPaused })
    if (!wasPaused) {
      // 进入暂停：中断播放和 sleep
      tts.stopAudio()
      this._abortSleep()
    }
  },

  onNext() {
    this._skipFlag = true
    tts.stopAudio()
    this._abortSleep()
  },

  onBack() {
    // 临时禁用系统拦截，避免和自定义 modal 双重弹窗
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload()
    }
    wx.showModal({
      title: '确定要退出听写吗?',
      content: `当前已听写到第 ${this.data.currentIndex + 1} 条 / 共 ${this.data.total} 条\n未完成的进度不会保存`,
      confirmText: '确认退出',
      cancelText: '继续听写',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          this._cancelled = true
          tts.stopAudio()
          this._abortSleep()
          wx.navigateBack()
        } else {
          // 取消退出 → 恢复系统拦截
          if (wx.enableAlertBeforeUnload) {
            wx.enableAlertBeforeUnload({
              message: '退出后未完成的听写进度不会保存,确认离开?'
            })
          }
        }
      },
      fail: () => {
        // modal 异常关闭也要恢复拦截
        if (wx.enableAlertBeforeUnload) {
          wx.enableAlertBeforeUnload({
            message: '退出后未完成的听写进度不会保存,确认离开?'
          })
        }
      }
    })
  }
})
