// cloudfunctions/ocr/index.js
// 调用微信通用印刷体识别。入参 { fileID }，返回 { success, items, error }
//
// 配额：免费 100 次/天/小程序。
// docs/04-服务集成.md 第 3.2 节

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileID } = event || {}
  if (!fileID) {
    return { success: false, error: '缺少参数 fileID' }
  }

  try {
    // 1. fileID → 临时 URL
    const fileRes = await cloud.getTempFileURL({ fileList: [fileID] })
    const file = fileRes && fileRes.fileList && fileRes.fileList[0]
    if (!file || !file.tempFileURL) {
      return { success: false, error: '获取临时文件 URL 失败' }
    }

    // 2. 调用微信印刷体 OCR
    const res = await cloud.openapi.ocr.printedText({
      type: 'photo',
      imgUrl: file.tempFileURL
    })

    // 3. 提取每行文字
    const items = (res.items || []).map(i => (i.text || '').trim()).filter(t => t.length > 0)

    return { success: true, items }
  } catch (err) {
    console.error('[ocr cloudfunction] failed:', err && err.message, err && err.errCode)
    // 常见错误码：errCode 99991663 = OCR 配额用完
    return {
      success: false,
      error: (err && err.errMsg) || (err && err.message) || 'OCR 识别失败',
      code: err && (err.errCode || err.code)
    }
  }
}
