const app = getApp()

Page({
  data: {
    avatarUrl: '/assets/default-avatar.png'
  },

  onLoad() {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({ avatarUrl: userInfo.avatarUrl })
    }
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  }
})
