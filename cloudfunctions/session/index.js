// cloudfunctions/session/index.js
// 保存一次听写记录到 sessions 集合。
// _openid 由云函数 context 自动注入；createdAt 由服务端时间戳生成。
//
// docs/03-数据模型.md 第 3 节
// docs/04-服务集成.md 第 7 节

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const { action, data } = event || {}
  const wxContext = cloud.getWXContext()

  if (action === 'save') {
    if (!data || !data.score || !Array.isArray(data.items)) {
      return { success: false, error: '入参不完整' }
    }

    try {
      const res = await db.collection('sessions').add({
        data: {
          _openid: wxContext.OPENID,
          createdAt: db.serverDate(),
          mode: data.mode || 'ocr',
          settings: data.settings || { readCount: 2, interval: 5 },
          score: data.score,
          items: data.items
        }
      })
      return { success: true, _id: res._id }
    } catch (err) {
      console.error('[session save] failed:', err && err.message)
      return { success: false, error: (err && err.message) || '保存失败' }
    }
  }

  // 用户在判分结果页手动修正某条对错 → 更新 session 的 score + items
  if (action === 'update') {
    if (!data || !data._id || !data.score || !Array.isArray(data.items)) {
      return { success: false, error: '入参不完整' }
    }

    try {
      // 验证该 session 属于当前用户(云函数下 db 操作不受 openid 限制,需手动 check)
      const existing = await db.collection('sessions').doc(data._id).get()
      if (!existing.data || existing.data._openid !== wxContext.OPENID) {
        return { success: false, error: '无权修改此记录' }
      }
      await db.collection('sessions').doc(data._id).update({
        data: {
          score: data.score,
          items: data.items
        }
      })
      return { success: true }
    } catch (err) {
      console.error('[session update] failed:', err && err.message)
      return { success: false, error: (err && err.message) || '更新失败' }
    }
  }

  return { success: false, error: `未知 action: ${action}` }
}
