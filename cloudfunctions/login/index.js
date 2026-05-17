// cloudfunctions/login/index.js
// 通过 wx.cloud.callFunction 触发时,wx-server-sdk 自动注入 OPENID
// 直接返回 openid 给前端缓存即可。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID
  }
}
