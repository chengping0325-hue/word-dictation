// 听写工具内部的底部 Tab（不走微信原生 tabBar，因为不是全局的）
const TAB_URLS = {
  dictation: '/pages/dictation/index/index',
  notebook: '/pages/dictation/notebook/index'
}

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    active: {
      type: String,
      value: 'dictation'
    }
  },
  methods: {
    switchTab(e) {
      const tab = e.currentTarget.dataset.tab
      if (tab === this.data.active) return
      const url = TAB_URLS[tab]
      if (url) {
        wx.redirectTo({ url })
      }
    }
  }
})
