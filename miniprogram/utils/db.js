const { db } = require('./cloudbase')

const sessionsCol = db.collection('sessions')

async function saveSession(session) {
  const app = getApp()
  const openid = app.globalData.openid
  return sessionsCol.add({
    data: {
      openid,
      words: session.words,
      result: session.result,
      score: session.score,
      total: session.total,
      createdAt: db.serverDate()
    }
  })
}

async function getSessions(limit = 20) {
  const app = getApp()
  const openid = app.globalData.openid
  return sessionsCol
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
}

module.exports = { saveSession, getSessions }
