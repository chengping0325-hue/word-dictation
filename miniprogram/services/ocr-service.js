// services/ocr-service.js
// 对前端业务暴露 recognize(fileID) → Promise<{ items: string[] }>
// 内部走 ocr 云函数（Phase 4 主方案：微信印刷体）

const { callCloudFunction } = require('../utils/cloud')

const OCR_QUOTA_EXCEEDED_CODE = 99991663

async function recognize(fileID) {
  const res = await callCloudFunction('ocr', { fileID })

  if (!res || !res.success) {
    const code = res && res.code
    let msg = (res && res.error) || 'OCR 识别失败'
    if (code === OCR_QUOTA_EXCEEDED_CODE) {
      msg = '今日识别次数已用完,请用手动核对'
    }
    const err = new Error(msg)
    err.code = code
    throw err
  }

  // 进一步后处理：去掉序号 "1. " "(1)" "①" 等开头，去掉首尾空白
  const items = (res.items || [])
    .map(t => t.replace(/^\s*[（(]?\d+[）)]?\s*[.、)]?\s*/, '').replace(/^\s*[①-⑩]\s*/, '').trim())
    .filter(t => t.length > 0)

  return { items }
}

module.exports = { recognize }
