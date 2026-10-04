// app.js

const CLOUD_ENV_ID = 'cloud1-d0gi6w2bn69381e7e'
const OPENID_CACHE_KEY = 'openid'

// 全局注入默认分享/转发处理，避免每个页面重复声明
const SHARE_TITLE = '单词听写喵 - 中英文听写小帮手'
const SHARE_PATH = '/pages/dictation/index/index'
const _originalPage = Page
Page = function(opts) {
  if (!opts.onShareAppMessage) {
    opts.onShareAppMessage = () => ({ title: SHARE_TITLE, path: SHARE_PATH })
  }
  if (!opts.onShareTimeline) {
    opts.onShareTimeline = () => ({ title: SHARE_TITLE })
  }
  return _originalPage(opts)
}

App({
  async onLaunch() {
    if (!wx.cloud) {
      console.error('[app.js] 请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })

    // 静默登录获取 openid。优先用缓存，没有则调 login 云函数。
    try {
      const cached = wx.getStorageSync(OPENID_CACHE_KEY)
      if (cached) {
        this.globalData.openid = cached
      } else {
        const res = await wx.cloud.callFunction({ name: 'login' })
        const openid = res && res.result && res.result.openid
        if (openid) {
          this.globalData.openid = openid
          wx.setStorageSync(OPENID_CACHE_KEY, openid)
        }
      }
    } catch (err) {
      console.error('[app.js] 获取 openid 失败:', err && err.message)
      // 不阻塞使用：openid 仅在云数据库 _openid 自动注入时由云函数获取，
      // 前端 globalData.openid 留空也不影响功能
    }
  },

  globalData: {
    openid: '',
    currentDictation: null,
    currentResult: null,
    pendingOcrResult: null
  }
})
