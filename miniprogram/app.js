// app.js

const CLOUD_ENV_ID = 'cloud1-d0gi6w2bn69381e7e'

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('[app.js] 请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    if (!CLOUD_ENV_ID) {
      console.warn('[app.js] CLOUD_ENV_ID 未配置 — 云函数调用会失败。请在 app.js 顶部填写。')
      // 不带 env 参数,使用默认环境（不一定能用,但不要直接抛错）
      wx.cloud.init({ traceUser: true })
    } else {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
    }
  },

  globalData: {
    openid: '',
    currentDictation: null,
    currentResult: null,
    pendingOcrResult: null
  }
})
