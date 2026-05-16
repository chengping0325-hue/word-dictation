App({
  globalData: {
    openid: null,
    userInfo: null
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请升级微信客户端至 2.2.1 以上')
      return
    }
    wx.cloud.init({
      env: 'cloud1-d0gi6w2bn69381e7e',
      traceUser: true
    })
    this.login()
  },

  login() {
    const self = this
    wx.cloud.callFunction({
      name: 'getOpenid',
      success(res) {
        self.globalData.openid = res.result.openid
        console.log('openid:', res.result.openid)
      },
      fail(err) {
        console.error('获取 openid 失败', err)
      }
    })
  },

  getOpenid() {
    return this.globalData.openid
  }
})
