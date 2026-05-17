// pages/dictation/index/index.js - 听写主页（Phase 2 完整实现）
const { detectType, getTypeLabel } = require('../../../services/type-detector')
const { normalize } = require('../../../services/grading-service')
const ocr = require('../../../services/ocr-service')
const { uploadToCloudStorage } = require('../../../utils/cloud')
const cache = require('../../../utils/cache')

// 约束（来自 docs/01-PRD.md 第 12.1 节）
const MIN_LEN = 1
const MAX_LEN = 200
const MAX_ITEMS = 50
const MIN_READ = 1
const MAX_READ = 5
const MIN_INTERVAL = 1
const MAX_INTERVAL = 30

// 拖拽：固定行高 100rpx
const ROW_HEIGHT_RPX = 100

// 判定 OCR 识别结果是否可疑（含数字或非常规字符）→ UI 高亮提醒
function looksSuspicious(text) {
  if (!text || text.length < 1) return true
  if (/[0-9]/.test(text)) return true
  if (/[#&*~^@<>{}[\]\\|]/.test(text)) return true
  // 全是奇怪字符
  if (!/[一-龥a-zA-Z]/.test(text)) return true
  return false
}

Page({
  data: {
    inputValue: '',
    currentType: '',
    typeLabel: '',
    pendingList: [],          // 每项含 { id, content, type, displayY }
    settings: { readCount: 2, interval: 5 },
    dragId: null              // 当前正在拖拽的 item id
  },

  // 实例级状态（不放 data 避免渲染开销）
  _rowHeightPx: 0,            // 一行的 px 高度（屏幕宽 / 750 * 100rpx）
  _dragStartY: 0,             // 触摸起始 y(client)
  _dragStartIndex: -1,        // 拖拽起始时该 item 的 index
  _orderIds: [],              // 当前可见的 id 顺序数组（拖拽过程中动态变化）

  onReady() {
    // 一次性计算 rpx → px 换算
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this._rowHeightPx = info.windowWidth / 750 * ROW_HEIGHT_RPX
  },

  onLoad() {
    this._restore()
  },

  onShow() {
    // 从 ocr-confirm 返回时，可能在 globalData.pendingOcrResult.confirmed 里带回新增条目
    const app = getApp()
    const merged = app.globalData.pendingOcrResult && app.globalData.pendingOcrResult.confirmed
    if (Array.isArray(merged) && merged.length > 0) {
      this._mergeFromOcr(merged)
      app.globalData.pendingOcrResult = null
    }
  },

  _restore() {
    const app = getApp()

    // 「重新听写」入口
    const pending = (app.globalData.currentDictation || {}).list
    if (Array.isArray(pending) && pending.length > 0) {
      this.setData({ pendingList: this._withDisplayY(pending) })
      cache.setPendingList(pending)
      app.globalData.currentDictation = null
      return
    }

    // 普通进入：从缓存恢复
    this.setData({
      pendingList: this._withDisplayY(cache.getPendingList()),
      settings: cache.getSettings()
    })
  },

  // 给清单每项加 displayY（基于其在数组中的 index 计算）
  _withDisplayY(list) {
    return (list || []).map((it, i) => Object.assign({}, it, { displayY: i * ROW_HEIGHT_RPX }))
  },

  // 缓存写入：去掉 displayY 字段(只持久化业务数据)
  _persistList(list) {
    const clean = list.map(it => ({ id: it.id, content: it.content, type: it.type }))
    cache.setPendingList(clean)
  },

  _mergeFromOcr(items) {
    const existing = this.data.pendingList.slice()
    const seen = new Set(existing.map(it => normalize(it.content)))
    for (const c of items) {
      if (existing.length >= MAX_ITEMS) break
      const k = normalize(c.content)
      if (k.length === 0 || seen.has(k)) continue
      seen.add(k)
      existing.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: c.content,
        type: c.type || detectType(c.content)
      })
    }
    const next = this._withDisplayY(existing)
    this.setData({ pendingList: next })
    this._persistList(next)
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
    const newList = this._withDisplayY(this.data.pendingList.concat([newItem]))
    this.setData({
      pendingList: newList,
      inputValue: '',
      currentType: '',
      typeLabel: ''
    })
    this._persistList(newList)
  },

  // ── 列表 ──
  onDelete(e) {
    const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
    if (!id) return
    const newList = this._withDisplayY(this.data.pendingList.filter(it => it.id !== id))
    this.setData({ pendingList: newList })
    this._persistList(newList)
  },

  // 点击条目 → 弹 wx.showModal editable 修改内容
  // 注意:长按拖拽后松手时 tap 也会触发,用 _justDragged 标记防误触
  onEditItem(e) {
    if (this._justDragged) {
      this._justDragged = false
      return
    }
    const id = e.currentTarget.dataset.id
    const target = this.data.pendingList.find(it => it.id === id)
    if (!target) return

    wx.showModal({
      title: '修改内容',
      editable: true,
      placeholderText: '输入单词或句子',
      content: target.content,
      confirmText: '保存',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        const newText = (res.content || '').trim()
        if (newText.length < MIN_LEN) {
          wx.showToast({ title: '内容不能为空', icon: 'none' })
          return
        }
        if (newText.length > MAX_LEN) {
          wx.showToast({ title: `单条最多 ${MAX_LEN} 字`, icon: 'none' })
          return
        }
        // 去重(除自己外)
        const newNorm = normalize(newText)
        const dup = this.data.pendingList.some(it => it.id !== id && normalize(it.content) === newNorm)
        if (dup) {
          wx.showToast({ title: '已存在', icon: 'none' })
          return
        }
        // 更新该条 + 重算 type
        const newList = this._withDisplayY(
          this.data.pendingList.map(it =>
            it.id === id ? Object.assign({}, it, { content: newText, type: detectType(newText) }) : it
          )
        )
        this.setData({ pendingList: newList })
        this._persistList(newList)
      }
    })
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

  // ── 拖拽排序 ──
  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    if (index == null) return
    const touch = e.touches && e.touches[0]
    if (!touch) return

    this._dragStartY = touch.clientY
    this._dragStartIndex = index
    this._orderIds = this.data.pendingList.map(it => it.id)
    // 标记:长按已激活,touchend 时 tap 会一并触发,需要跳过 tap 的编辑逻辑
    this._justDragged = true

    // 触觉反馈
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })

    this.setData({ dragId: id })
  },

  onTouchMove(e) {
    if (!this.data.dragId) return
    const touch = e.touches && e.touches[0]
    if (!touch) return

    const deltaPx = touch.clientY - this._dragStartY
    const deltaRpx = deltaPx / this._rowHeightPx * ROW_HEIGHT_RPX
    const total = this._orderIds.length

    // 计算新位置 index（不超出边界）
    let targetIndex = this._dragStartIndex + Math.round(deltaPx / this._rowHeightPx)
    if (targetIndex < 0) targetIndex = 0
    if (targetIndex > total - 1) targetIndex = total - 1

    // 重新排列 _orderIds：把 dragId 从原 startIndex 拿出，插入 targetIndex
    const newOrder = this._orderIds.filter(id => id !== this.data.dragId)
    newOrder.splice(targetIndex, 0, this.data.dragId)

    // 根据 newOrder 计算每项的 displayY
    // dragId 项的 displayY = startIndex * ROW_HEIGHT + deltaRpx（跟手）
    // 其它项：按 newOrder 中的 index * ROW_HEIGHT
    const updatedList = this.data.pendingList.map(it => {
      if (it.id === this.data.dragId) {
        return Object.assign({}, it, { displayY: this._dragStartIndex * ROW_HEIGHT_RPX + deltaRpx })
      }
      const newIdx = newOrder.indexOf(it.id)
      return Object.assign({}, it, { displayY: newIdx * ROW_HEIGHT_RPX })
    })

    // 仅在 newOrder 真正变化时更新 _orderIds
    this._orderIds = newOrder
    this.setData({ pendingList: updatedList })
  },

  onTouchEnd() {
    if (!this.data.dragId) return

    // 按 _orderIds 真正重排 pendingList
    const byId = {}
    this.data.pendingList.forEach(it => { byId[it.id] = it })
    const reordered = this._orderIds.map((id, i) => Object.assign({}, byId[id], { displayY: i * ROW_HEIGHT_RPX }))

    this.setData({
      pendingList: reordered,
      dragId: null
    })
    this._persistList(reordered)

    this._dragStartY = 0
    this._dragStartIndex = -1
    this._orderIds = []
  },

  // ── 拍照录入（Phase 4 真实 OCR） ──
  onCameraTap() {
    const app = getApp()
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        wx.showLoading({ title: '识别中…', mask: true })
        uploadToCloudStorage(filePath, 'ocr-input')
          .then(fileID => ocr.recognize(fileID))
          .then(({ items }) => {
            wx.hideLoading()
            // 把识别条目预处理为带 type 的对象
            const enriched = items.map(text => ({
              content: text,
              type: detectType(text),
              suspicious: looksSuspicious(text)
            }))
            app.globalData.pendingOcrResult = { items: enriched, confirmed: null }
            wx.navigateTo({ url: '/pages/dictation/ocr-confirm/index' })
          })
          .catch(err => {
            wx.hideLoading()
            console.error('[home] OCR 失败:', err && err.message)
            wx.showToast({ title: (err && err.message) || '识别失败', icon: 'none', duration: 2200 })
          })
      },
      fail: () => {
        // 用户取消选图：不需要提示
      }
    })
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
