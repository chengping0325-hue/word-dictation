// miniprogram/utils/ocr.js
// 封装微信 OCR 插件调用。
// 使用前提：在微信小程序后台「设置 → 第三方设置 → 插件管理」添加 OCR 插件，
// 并在 app.json 的 plugins 字段声明：
//   "plugins": {
//     "ocr-plugin": { "version": "<版本号>", "provider": "<插件 appid>" }
//   }
// 然后取消下面 ocrPlugin = requirePlugin(...) 一行的注释。

let ocrPlugin = null
try {
  // 一旦在 app.json 声明插件，将此行取消注释：
  // ocrPlugin = requirePlugin('ocr-plugin')
} catch (e) {
  console.warn('[ocr] plugin not registered yet', e)
}

/**
 * 调用微信 OCR 插件识别图片中的文字
 * @param {string} filePath 本地图片路径
 * @returns {Promise<string[]>} 切分后的词数组
 */
async function recognizeWords(filePath) {
  if (!ocrPlugin) {
    throw new Error('OCR 插件尚未配置。请在小程序后台添加微信 OCR 插件，并在 utils/ocr.js 中开启 requirePlugin。')
  }
  // 不同 OCR 插件 API 不同。常见模式如下，按实际插件调整：
  const res = await ocrPlugin.generalOcr({ imgPath: filePath })
  const fullText = res.text || (res.items || []).map(i => i.text).join('\n')
  return splitToWords(fullText)
}

/**
 * 把识别到的文本按空白/换行/常见标点切分为词数组
 * - 不去重（保留原顺序）
 * - 去空白
 */
function splitToWords(text) {
  if (!text) return []
  return text
    .split(/[\s\n\t,，、;；]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0)
}

/**
 * 入口函数：让用户拍照/选图，识别后返回词数组
 */
function chooseAndRecognize() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          const words = await recognizeWords(res.tempFiles[0].tempFilePath)
          resolve(words)
        } catch (e) {
          reject(e)
        }
      },
      fail: reject
    })
  })
}

module.exports = { recognizeWords, chooseAndRecognize, splitToWords }
