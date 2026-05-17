// cloudfunctions/tts/index.js
//
// 腾讯云 TTS 转发：前端调 wx.cloud.callFunction({ name: 'tts', data: { text, lang } })
// 入参：
//   text:  string, 待朗读的文本
//   lang:  'zh' | 'en'
// 返回：
//   { success: true,  audioBase64, format: 'mp3', requestId }
//   { success: false, error, code? }
//
// ⚠️ 密钥必须通过云开发控制台的"环境变量"配置，不在代码或 git 里出现。
//    需配置（Key 名严格匹配，否则 process.env 读不到）：
//      SecretId
//      SecretKey
//
// 音色映射（来自项目所有者约定）：
//   zh → VoiceType 1001（智瑜，基础女声），PrimaryLanguage 1
//   en → VoiceType 1050（WeJack，基础英文男声），PrimaryLanguage 2
//   均走"800 万字符通用语音合成"免费资源包

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const tencentcloud = require('tencentcloud-sdk-nodejs-tts')
const TtsClient = tencentcloud.tts.v20190823.Client

const VOICE_MAP = {
  zh: { VoiceType: 1001, PrimaryLanguage: 1 },
  en: { VoiceType: 1050, PrimaryLanguage: 2 }
}

exports.main = async (event) => {
  const { text, lang } = event || {}

  if (!text || typeof text !== 'string') {
    return { success: false, error: '缺少参数 text' }
  }
  if (lang !== 'zh' && lang !== 'en') {
    return { success: false, error: "lang 必须是 'zh' 或 'en'" }
  }

  const secretId = process.env.SecretId
  const secretKey = process.env.SecretKey
  if (!secretId || !secretKey) {
    return {
      success: false,
      error: '云函数未配置 SecretId / SecretKey 环境变量'
    }
  }

  const voice = VOICE_MAP[lang]

  const client = new TtsClient({
    credential: { secretId, secretKey },
    region: 'ap-shanghai',
    profile: {
      httpProfile: { endpoint: 'tts.tencentcloudapi.com' }
    }
  })

  const params = {
    Text: text,
    SessionId: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    VoiceType: voice.VoiceType,
    PrimaryLanguage: voice.PrimaryLanguage,
    SampleRate: 16000,
    Codec: 'mp3',
    ModelType: 1,
    Volume: 0,
    Speed: 0
  }

  try {
    const res = await client.TextToVoice(params)
    return {
      success: true,
      audioBase64: res.Audio,
      format: 'mp3',
      requestId: res.RequestId
    }
  } catch (err) {
    console.error('[tts cloudfunction] failed:', err && err.message, err && err.code)
    return {
      success: false,
      error: (err && err.message) || 'TTS 调用失败',
      code: err && err.code
    }
  }
}
