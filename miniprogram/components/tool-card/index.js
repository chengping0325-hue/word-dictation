Component({
  properties: {
    icon: String,
    name: String,
    desc: String,
    path: String,
    disabled: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      if (this.data.disabled) return
      wx.navigateTo({ url: this.data.path })
    }
  }
})
