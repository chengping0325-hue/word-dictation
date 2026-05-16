// app.js
// 入口：globalData 占位 + 云开发初始化（Phase 4 才真正调用）
App({
  onLaunch() {
    // Phase 4 接入云开发时取消注释，填入真实环境 ID
    // if (wx.cloud) {
    //   wx.cloud.init({
    //     env: 'YOUR-CLOUD-ENV-ID',
    //     traceUser: true
    //   })
    // }
  },

  globalData: {
    openid: '',
    currentDictation: null,
    currentResult: null,
    pendingOcrResult: null
  }
})
