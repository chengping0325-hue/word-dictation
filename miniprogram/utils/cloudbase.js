wx.cloud.init({ env: 'cloud1-d0gi6w2bn69381e7e', traceUser: true })
const db = wx.cloud.database()
const _ = db.command

module.exports = { db, _ }
