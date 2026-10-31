// pages/dictation/index/index.js - 听写主页（Phase 2 完整实现）
const { detectType, getTypeLabel } = require('../../../services/type-detector')
const { normalize } = require('../../../services/grading-service')
const ocr = require('../../../services/ocr-service')
const tts = require('../../../services/tts-service')
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

// 滚动内容比容器多出的高度（rpx）。作用：让内容永远略微超过可视区，
// 空清单时也能拉动回弹（iOS 只有 contentSize > bounds 才可滚动）。
//
// 只取 60rpx(30px)：够拉出一点弹性即可。
// 这个值和 .dictation-content 的 padding-bottom 是两套独立机制 ——
// min-height 撑起的是内容整体高度，padding 是内容下方的留白 ——
// 两者叠加会让空清单时底部出现大片空白，所以这里要小。
const BOUNCE_EXTRA_RPX = 60

// 判定 OCR 识别结果是否可疑（含数字或非常规字符）→ UI 高亮提醒
function looksSuspicious(text) {
  if (!text || text.length < 1) return true
  if (/[0-9]/.test(text)) return true
  if (/[#&*~^@<>{}[\]\\|]/.test(text)) return true
  // 全是奇怪字符
  if (!/[一-龥a-zA-Z]/.test(text)) return true
  return false
}

/**
 * 从拖拽事件里取手指的 clientY。
 *
 * enhanced 模式下 scroll-view 会接管 touch 事件，各端/各版本暴露的字段不完全一致：
 *   1. e.touches[0].clientY   —— 最常见（社区示例即用此写法）
 *   2. e.changedTouches[0]    —— touchend 时的兜底
 *   3. e.detail.scrollTop     —— 官方文档明确列出的字段，用滚动位移反推
 * 任一可用即可，取不到返回 null（本次拖拽计算跳过，不做错误推断）。
 */
function _touchClientY(e) {
  if (!e) return null
  const t = e.touches && e.touches[0]
  if (t && typeof t.clientY === 'number') return t.clientY
  const ct = e.changedTouches && e.changedTouches[0]
  if (ct && typeof ct.clientY === 'number') return ct.clientY
  return null
}

Page({
  data: {
    inputValue: '',
    currentType: '',
    typeLabel: '',
    pendingList: [],          // 每项含 { id, content, type, displayY }
    settings: { readCount: 2, interval: 5 },
    dragId: null,             // 当前正在拖拽的 item id
    scrollMinHeight: 0        // 内容区最小高度(px)，见 _measureScrollMinHeight
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
    this._windowWidth = info.windowWidth

    // 计算滚动内容的最小高度（见 _measureScrollMinHeight 的说明）
    this._measureScrollMinHeight()
  },

  /**
   * 让内容区始终比滚动容器高出 BOUNCE_EXTRA_PX，
   * 这样即使内容不足一屏（空清单时），也能拉动并回弹。
   *
   * 原理：iOS 的 UIScrollView 只有在 contentSize > bounds 时才可滚动，
   * 内容不足一屏就没有回弹。小程序 scroll-view 同理。
   * 给内容区一个「容器高度 + 一点余量」的 min-height，
   * 就能获得恒定的回弹手感，且多出来的部分是空白，不影响视觉。
   *
   * 用 JS 实测而不是写百分比：scroll-view 的直接子元素用百分比高度
   * 在部分 WebView 下解析基准不确定，实测值最可靠。
   */
  _measureScrollMinHeight() {
    wx.createSelectorQuery()
      .in(this)
      .select('.dictation-scroll')
      .boundingClientRect(rect => {
        if (!rect || !rect.height) return
        const extraPx = BOUNCE_EXTRA_RPX * (this._windowWidth || 375) / 750
        this.setData({ scrollMinHeight: Math.round(rect.height + extraPx) })
      })
      .exec()
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
  //
  // 事件来源（两条通路，共用同一套计算逻辑）：
  //   A. 列表项的 bindtouchmove / bindtouchend
  //      —— enhanced 模式下 scroll-view 接管 touch，touchmove 仍能收到，
  //         且**能冒泡到 scroll-view**（所以在列表项上滑动能滚列表）
  //   B. scroll-view 的 binddragstart / binddragging / binddragend
  //      —— enhanced 专属事件，作为 A 的补充
  //
  // 滚动冲突的解法是 **scroll-y="{{ !dragId }}"**：
  // 拖拽激活时关掉滚动，touchmove 冒泡上去也不会产生位移。
  //
  // 为什么不用 catchtouchmove：
  //   catch 会阻止手势冒泡 → 在列表项上滑动时列表不滚动 →
  //   词条一多、可见区域几乎全是列表项时，用户就滑不动、滑不到顶部。
  //   这是本项目踩过的坑，已彻底移除。
  //
  // 为什么不用 catchtouchmove="false"：
  //   catch 系列即使值为 "false" 也会阻止冒泡（社区实测 + 官方未明确豁免）。
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

  // scroll-view 开始拖动（enhanced 模式）。用于在拖动发生的瞬间补记起点坐标 ——
  // 长按后手指可能已经移动了一点，onLongPress 记的 clientY 会有偏差。
  onDragStart(e) {
    if (!this.data.dragId) return
    const y = _touchClientY(e)
    if (y === null) return
    // 用当前 clientY 重新校准起点，保证拖拽项跟手
    this._dragStartY = y
    const idx = this._orderIds.indexOf(this.data.dragId)
    this._dragStartIndex = idx < 0 ? 0 : idx
  },

  // 通路 A：列表项的 touchmove
  onTouchMove(e) {
    if (!this.data.dragId) return
    const y = _touchClientY(e)
    if (y === null) return
    this._applyDrag(y)
  },

  // 通路 B：scroll-view 的 dragging（enhanced 专属）
  onDragMove(e) {
    if (!this.data.dragId) return
    const y = _touchClientY(e)
    if (y === null) return
    this._applyDrag(y)
  },

  /**
   * 按手指当前位置计算目标索引并更新各项位移。
   * 通路 A / B 共用，保证两条通路同时存在时结果一致（不会叠加两倍位移）。
   */
  _applyDrag(clientY) {
    const deltaPx = clientY - this._dragStartY
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

  // 通路 A：列表项的 touchend
  onTouchEnd() {
    this._finishDrag()
  },

  // 通路 B：scroll-view 的 dragend（enhanced 专属）
  onDragEnd() {
    this._finishDrag()
  },

  _finishDrag() {
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

  // ── 问题反馈 ──
  onFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' })
  },

  // ── 开始听写 ──
  onStart() {
    if (this.data.pendingList.length === 0) {
      wx.showToast({ title: '请先添加内容', icon: 'none' })
      return
    }
    // ⚠️ 必须在用户手势的同步栈内调用（iOS 音频会话唤醒）。
    //    放到 navigateTo 之后或任何 await 之后都会失效。
    //    详见 services/tts-service.js 顶部说明。
    tts.unlockAudio()

    const app = getApp()
    app.globalData.currentDictation = {
      list: this.data.pendingList.slice(),
      readCount: this.data.settings.readCount,
      interval: this.data.settings.interval
    }
    wx.navigateTo({ url: '/pages/dictation/playing/index' })
  }
})
