function compareWords(original, written) {
  return original.map((word, i) => {
    const w = (written[i] || '').toLowerCase().trim()
    const o = word.toLowerCase().trim()
    return {
      original: word,
      written: written[i] || '（未识别）',
      correct: w === o
    }
  })
}

module.exports = { compareWords }
