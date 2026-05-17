// utils/cloud.js
// 云开发调用的轻量封装。集中处理失败提示，避免每个 page 重复写 try/catch。

function callCloudFunction(name, data) {
  return wx.cloud.callFunction({ name, data: data || {} })
    .then(res => res.result)
    .catch(err => {
      console.error(`[cloud] callFunction ${name} failed:`, err && err.errMsg)
      throw err
    })
}

function uploadToCloudStorage(filePath, prefix) {
  const dir = prefix || 'uploads'
  const ext = (filePath.match(/\.([a-zA-Z0-9]+)$/) || [, 'jpg'])[1]
  const cloudPath = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  return wx.cloud.uploadFile({ cloudPath, filePath }).then(res => res.fileID)
}

module.exports = { callCloudFunction, uploadToCloudStorage }
