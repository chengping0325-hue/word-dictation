// 状态栏占位组件（自定义导航栏页面使用）
// 通过 wx.getSystemInfoSync().statusBarHeight 拿到状态栏高度，铺一块同高度的占位 view
Component({
  properties: {
    background: {
      type: String,
      value: 'transparent'
    }
  },

  data: {
    statusBarHeight: 20
  },

  lifetimes: {
    attached() {
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        this.setData({ statusBarHeight: info.statusBarHeight || 20 })
      } catch (e) {
        // ignore，使用默认值
      }
    }
  }
})
