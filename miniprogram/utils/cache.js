// utils/cache.js
// 本地缓存读写封装（pendingList、settings）。所有对 wx.storage 的访问都集中在这里。

const KEY_PENDING_LIST = 'pendingList'
const KEY_SETTINGS = 'settings'

const DEFAULT_SETTINGS = { readCount: 2, interval: 5 }

function getPendingList() {
  try {
    const list = wx.getStorageSync(KEY_PENDING_LIST)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function setPendingList(list) {
  wx.setStorageSync(KEY_PENDING_LIST, Array.isArray(list) ? list : [])
}

function clearPendingList() {
  wx.removeStorageSync(KEY_PENDING_LIST)
}

function getSettings() {
  try {
    const s = wx.getStorageSync(KEY_SETTINGS)
    if (s && typeof s.readCount === 'number' && typeof s.interval === 'number') return s
  } catch (e) {}
  return Object.assign({}, DEFAULT_SETTINGS)
}

function setSettings(s) {
  wx.setStorageSync(KEY_SETTINGS, s)
}

module.exports = {
  getPendingList,
  setPendingList,
  clearPendingList,
  getSettings,
  setSettings,
  DEFAULT_SETTINGS
}
