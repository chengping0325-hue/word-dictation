const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
const OcrClient = tencentcloud.ocr.v20181119.Client

// 替换为你在腾讯云控制台创建的 API 密钥
const SECRET_ID = 'YOUR_SECRET_ID'
const SECRET_KEY = 'YOUR_SECRET_KEY'

exports.main = async (event) => {
  const { fileID } = event

  const res = await cloud.downloadFile({ fileID })
  const base64 = res.fileContent.toString('base64')

  const client = new OcrClient({
    credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
    region: 'ap-shanghai'
  })

  const result = await client.GeneralBasicOCR({
    ImageBase64: base64,
    LanguageType: 'ENG'
  })

  const words = result.TextDetections
    .map(d => d.DetectedText.trim().toLowerCase())
    .filter(w => /^[a-z]+$/.test(w))

  return { words }
}
