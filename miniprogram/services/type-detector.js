// services/type-detector.js
// 输入文本 → 类型('en_word' | 'cn_word' | 'en_sentence' | 'cn_sentence')
//
// 判定规则（来自 docs/01-PRD.md 第 3 节）：
//   - 含汉字：长度 > 6 或 包含中文标点 → cn_sentence，否则 cn_word
//   - 不含汉字：含空格 → en_sentence，否则 en_word
//
// 该模块同时兼容 WeChat 小程序（CommonJS require）和 Node.js（用于跑测试）。

const RE_CHINESE = /[一-龥]/
const RE_SPACE = /\s/
// 中英文标点（半角 + 全角）。'don\'t' 的撇号不算（不在表里）
const RE_PUNCT = /[，。！？；：、""''《》【】「」,.!?;:]/

function detectType(text) {
  if (typeof text !== 'string') return 'en_word'
  const trimmed = text.trim()
  if (trimmed.length === 0) return 'en_word'

  const hasChinese = RE_CHINESE.test(trimmed)
  const hasSpace = RE_SPACE.test(trimmed)
  const hasPunct = RE_PUNCT.test(trimmed)

  if (hasChinese) {
    if (trimmed.length > 6 || hasPunct) return 'cn_sentence'
    return 'cn_word'
  }
  if (hasSpace) return 'en_sentence'
  return 'en_word'
}

function getLang(type) {
  return (type && type.indexOf('en') === 0) ? 'en_US' : 'zh_CN'
}

function getTypeLabel(type) {
  switch (type) {
    case 'en_word': return 'EN'
    case 'cn_word': return '中'
    case 'en_sentence': return 'EN 句'
    case 'cn_sentence': return '中 句'
    default: return ''
  }
}

module.exports = { detectType, getLang, getTypeLabel }
