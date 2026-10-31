// pages/feedback/index.js
// 问题反馈页 —— 通过二维码引导用户添加企业微信客服。
//
// 设计要点：
//   1. 二维码用 show-menu-by-longpress="{{true}}" 开启长按识别菜单。
//      该属性默认 false，不加的话长按只会弹"保存图片"，识别不出码。
//      官方文档「支持长按识别的码」表格：企业微信个人码需基础库 ≥ 2.18.0。
//      project.config.json 的 libVersion 是 3.15.2，满足要求。
//      另注：show-menu-by-longpress 场景需 iOS ≥ 8.0.8 / 安卓 ≥ 8.0.7。
//   2. 图片必须是包内本地路径或合法 HTTPS 地址。tempFilePath 会被硬性拦截。
//      本项目用包内路径 miniprogram/assets/feedback-qrcode.png，无需配域名。
//   3. mode 用 widthFix 而非 aspectFit —— 固定宽高会挤压点阵导致识别失败。
//   4. 二维码内容是企业微信「联系我」渠道活码
//      (https://work.weixin.qq.com/u/vcd...)，长按后由微信原生能力打开
//      企业微信加好友页。不走本页面代码，无需自行解析链接。
//   5. 「复制邮箱」是长按识别失败时的兜底路径（低版本基础库 / 用户不熟悉长按）。
//      用邮箱而非微信号：用户加的是企业微信，拿不到也不需要个人微信号，
//      邮箱是唯一确定能收到反馈的渠道。

// 客服邮箱。与 docs/PRIVACY.md / docs/PRIVACY-PLAIN.txt 保持一致。
const CONTACT_EMAIL = 'chengping0325@gmail.com'

Page({
  data: {
    qrImage: '/assets/feedback-qrcode.png',
    contactEmail: CONTACT_EMAIL,
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

  // 复制邮箱（兜底路径）
  onCopyEmail() {
    wx.setClipboardData({
      data: CONTACT_EMAIL,
      success: () => {
        this.setData({ copied: true })
        wx.showToast({ title: '邮箱已复制', icon: 'none' })
        // 2.5 秒后恢复按钮文案
        setTimeout(() => {
          if (this._alive) this.setData({ copied: false })
        }, 2500)
      },
      fail: (err) => {
        console.error('[feedback] 复制邮箱失败:', err && err.errMsg)
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
