// pages/feedback/index.js
// 问题反馈页 —— 通过二维码引导用户添加企业微信客服。
//
// 设计要点：
//   1. 二维码用 show-menu-by-longpress="{{true}}" 开启长按识别菜单。
//      该属性默认 false，不加的话长按只会弹"保存图片"，识别不出码。
//      官方文档「支持长按识别的码」表格：企业微信个人码需基础库 ≥ 2.18.0。
//      project.config.json 的 libVersion 是 3.15.2，满足要求。
//   2. 图片必须是包内本地路径或合法 HTTPS 地址。tempFilePath 会被硬性拦截。
//      本项目用包内路径 miniprogram/assets/feedback-qrcode.png，无需配域名。
//   3. 「复制微信号」是长按识别失败时的兜底路径（低版本基础库 / 用户不熟悉长按）。

// 客服微信号。改这里即可，页面其他位置不硬编码。
const CONTACT_WECHAT = 'chengping0325'

Page({
  data: {
    qrImage: '/assets/feedback-qrcode.png',
    wechatId: CONTACT_WECHAT,
    copied: false
  },

  onShareAppMessage() {
    return {
      title: '单词听写喵 - 遇到问题？这里能找到我们',
      path: '/pages/feedback/index'
    }
  },

  // 长按二维码会弹微信原生菜单（含"识别图中二维码"→ 跳转企业微信加好友）
  // 这里不做额外处理，交给微信原生能力
  onTapQrcode() {
    // 短按不响应。二维码场景下用户误触短按不应该有反馈，
    // 否则用户会以为长按识别坏了。
  },

  // 复制微信号（兜底路径）
  onCopyWechat() {
    wx.setClipboardData({
      data: CONTACT_WECHAT,
      success: () => {
        this.setData({ copied: true })
        wx.showToast({ title: '微信号已复制', icon: 'none' })
        // 2.5 秒后恢复按钮文案
        setTimeout(() => {
          if (this._alive) this.setData({ copied: false })
        }, 2500)
      },
      fail: (err) => {
        console.error('[feedback] 复制微信号失败:', err && err.errMsg)
        wx.showToast({ title: '复制失败,请手动记录', icon: 'none' })
      }
    })
  },

  onLoad() {
    this._alive = true
  },

  onUnload() {
    this._alive = false
  }
})
