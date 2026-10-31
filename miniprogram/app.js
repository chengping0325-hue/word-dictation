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
    // 音频全局选项。必须在 onLaunch 最前面设置，对之后创建的 InnerAudioContext 生效。
    //
    // obeyMuteSwitch: false —— iOS 上 InnerAudioContext 默认跟随物理静音键，
    //   用户手机拨到静音后听写全程无声且没有任何提示（看起来像 App 卡死）。
    //   设为 false 后静音模式下照常出声。仅 iOS 生效，安卓无副作用。
    //   注意：基础库 2.3.0 起实例级 ctx.obeyMuteSwitch 已失效，
    //   官方要求统一用 wx.setInnerAudioOption 全局设置。
    //
    // speakerOn: true —— 走扬声器。微信规定 speakerOn 为 true 时会忽略
    //   mixWithOther 强制与其他音频互斥。听写场景优先保证声音外放清晰，
    //   用户手机正在放音乐时会被短暂打断，这是产品上接受的取舍。
    //
    // mixWithOther: true —— 保留混播意图。当前 speakerOn 为 true 时该参数
    //   不生效，若未来微信放开限制则自动变为混播。
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true,
        speakerOn: true,
        fail: (err) => {
          console.warn('[app.js] setInnerAudioOption 失败:', err && err.errMsg)
        }
      })
    }

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
