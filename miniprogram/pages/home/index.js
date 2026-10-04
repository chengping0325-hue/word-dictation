// 兼容旧版本分享卡片和历史入口。
// 当前产品启动页已改为听写主页，此页面不再展示工具集合。
Page({
  onLoad() {
    wx.reLaunch({ url: '/pages/dictation/index/index' })
  }
})
