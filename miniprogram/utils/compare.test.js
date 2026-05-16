// miniprogram/utils/compare.test.js
// 在 app.js onLaunch 顶部临时 require('./utils/compare.test') 跑一次，确认全 PASS 后删除该 require
const { compareWords } = require('./compare')

const cases = [
  // [original, written, expectedCorrect]
  ['apple', 'apple', true],
  ['apple', 'Apple', true],
  ['apple', 'apples', false],
  ['苹果', '苹果', true],
  ['苹果', '苹', false],
  ['苹果', '苹果 ', true],  // trim
  ['banana', '香蕉', false],
]

cases.forEach(([o, w, expect], i) => {
  const result = compareWords([o], [w])[0]
  const pass = result.correct === expect
  console.log(`[${pass ? 'PASS' : 'FAIL'}] case ${i}: ${o} vs ${w} → ${result.correct} (expect ${expect})`)
})
