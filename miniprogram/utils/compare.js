// miniprogram/utils/compare.js
function normalize(s) {
  const trimmed = (s || '').trim()
  // 只对全英文做 lowercase；含中文时保留原样
  return /^[a-zA-Z]+$/.test(trimmed) ? trimmed.toLowerCase() : trimmed
}

function compareWords(original, written) {
  return original.map((word, i) => {
    const w = written[i] || ''
    return {
      original: word,
      written: w || '（未识别）',
      correct: normalize(word) === normalize(w)
    }
  })
}

module.exports = { compareWords, normalize }
