Component({
  properties: {
    active: { type: String, value: 'listen' }  // 'listen' | 'wordbook'
  },
  methods: {
    goListen() {
      if (this.data.active === 'listen') return
      wx.redirectTo({ url: '/pages/dictation/index' })
    },
    goWordbook() {
      if (this.data.active === 'wordbook') return
      wx.redirectTo({ url: '/pages/wordbook/index' })
    }
  }
})
