// pages/dictation/index/index.js - 听写主页（Phase 2 完整实现）
const { detectType, getTypeLabel } = require('../../../services/type-detector')
const { normalize } = require('../../../services/grading-service')
const cache = require('../../../utils/cache')

// 约束（来自 docs/01-PRD.md 第 12.1 节）
const MIN_LEN = 1
const MAX_LEN = 200
const MAX_ITEMS = 50
const MIN_READ = 1
const MAX_READ = 5
const MIN_INTERVAL = 3
const MAX_INTERVAL = 30

Page({
  data: {
    inputValue: '',
    currentType: '',     // 'en_word' | 'cn_word' | 'en_sentence' | 'cn_sentence' | ''
    typeLabel: '',       // 输入框下的实时 tag 文案
    pendingList: [],
    settings: { readCount: 2, interval: 5 }
  },

  onLoad() {
    const app = getApp()

    // 「重新听写」入口（来自单词本/判分结果页）：globalData.currentDictation.list 已被预填充
    const pending = (app.globalData.currentDictation || {}).list
    if (Array.isArray(pending) && pending.length > 0) {
      this.setData({ pendingList: pending })
      cache.setPendingList(pending)
      app.globalData.currentDictation = null
      return
    }

    // 普通进入：从缓存恢复
    this.setData({
      pendingList: cache.getPendingList(),
      settings: cache.getSettings()
    })
  },

  // ── 输入 ──
  onInput(e) {
    const text = e.detail.value
    if (!text || !text.trim()) {
      this.setData({ inputValue: text || '', currentType: '', typeLabel: '' })
      return
    }
    const type = detectType(text)
    this.setData({
      inputValue: text,
      currentType: type,
      typeLabel: getTypeLabel(type)
    })
  },

  onAdd() {
    const text = (this.data.inputValue || '').trim()
    if (text.length < MIN_LEN) {
      wx.showToast({ title: '请先输入内容', icon: 'none' })
      return
    }
    if (text.length > MAX_LEN) {
      wx.showToast({ title: `单条最多 ${MAX_LEN} 字`, icon: 'none' })
      return
    }
    if (this.data.pendingList.length >= MAX_ITEMS) {
      wx.showToast({ title: `单次最多 ${MAX_ITEMS} 条`, icon: 'none' })
      return
    }
    const normalized = normalize(text)
    const dup = this.data.pendingList.some(it => normalize(it.content) === normalized)
    if (dup) {
      wx.showToast({ title: '已存在', icon: 'none' })
      return
    }
    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: text,
      type: detectType(text)
    }
    const newList = this.data.pendingList.concat([newItem])
    this.setData({
      pendingList: newList,
      inputValue: '',
      currentType: '',
      typeLabel: ''
    })
    cache.setPendingList(newList)
  },

  // ── 列表 ──
  onDelete(e) {
    const id = e.detail && e.detail.item && e.detail.item.id
    if (!id) return
    const newList = this.data.pendingList.filter(it => it.id !== id)
    this.setData({ pendingList: newList })
    cache.setPendingList(newList)
  },

  onClearAll() {
    if (this.data.pendingList.length === 0) return
    wx.showModal({
      title: '确认清空',
      content: `当前清单 ${this.data.pendingList.length} 条内容将全部清除`,
      confirmText: '清空',
      confirmColor: '#dc2626',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({ pendingList: [] })
          cache.clearPendingList()
        }
      }
    })
  },

  // ── 拍照（Phase 2：跳到 OCR 确认页，页面里仍是假数据，Phase 4 接真实 OCR） ──
  onCameraTap() {
    wx.navigateTo({ url: '/pages/dictation/ocr-confirm/index' })
  },

  // ── 设置 ──
  onStepperMinus(e) {
    const key = e.currentTarget.dataset.key
    const min = key === 'readCount' ? MIN_READ : MIN_INTERVAL
    this._applySetting(key, Math.max(min, this.data.settings[key] - 1))
  },
  onStepperPlus(e) {
    const key = e.currentTarget.dataset.key
    const max = key === 'readCount' ? MAX_READ : MAX_INTERVAL
    this._applySetting(key, Math.min(max, this.data.settings[key] + 1))
  },
  _applySetting(key, val) {
    const s = Object.assign({}, this.data.settings, { [key]: val })
    this.setData({ settings: s })
    cache.setSettings(s)
  },

  // ── 开始听写 ──
  onStart() {
    if (this.data.pendingList.length === 0) {
      wx.showToast({ title: '请先添加内容', icon: 'none' })
      return
    }
    const app = getApp()
    app.globalData.currentDictation = {
      list: this.data.pendingList.slice(),
      readCount: this.data.settings.readCount,
      interval: this.data.settings.interval
    }
    wx.navigateTo({ url: '/pages/dictation/playing/index' })
  }
})
