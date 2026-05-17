// 跑法: node miniprogram/services/grading-service.test.js
const { normalize, gradeSession, wordLevelDiff } = require('./grading-service')

let passed = 0
let failed = 0

function check(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}\n      expected=${JSON.stringify(expected)}\n      got     =${JSON.stringify(actual)}`) }
}

function checkTrue(actual, label) {
  if (actual) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label} (got ${JSON.stringify(actual)})`) }
}

console.log('normalize:')
check(normalize('Apple!'), 'apple', 'Apple! → apple')
check(normalize('床前明月光,'), '床前明月光', '床前明月光, → 床前明月光')
check(normalize('I  like   apples.'), 'i like apples', '多空格压缩')
check(normalize("don't"), 'dont', "don't 撇号去掉")
check(normalize('  '), '', '空白串')

console.log('\ngradeSession - docs/05 case:')
const r1 = gradeSession(
  [
    { content: 'apple', type: 'en_word' },
    { content: 'orange', type: 'en_word' }
  ],
  ['Apple', 'oraneg']
)
check(r1.score.correct, 1, 'correct=1')
check(r1.score.total, 2, 'total=2')
check(r1.items[0].isCorrect, true, 'apple 正确')
check(r1.items[1].isCorrect, false, 'orange 错（oraneg）')
checkTrue(r1.items[1].userAnswer === 'oraneg', '用户答案被识别为 oraneg')

console.log('\ngradeSession - 中文标点容忍:')
const r2 = gradeSession(
  [{ content: '床前明月光', type: 'cn_sentence' }],
  ['床前明月光,']
)
check(r2.items[0].isCorrect, true, '床前明月光, 匹配 床前明月光')

console.log('\ngradeSession - 英文句子词级 diff:')
const r3 = gradeSession(
  [{ content: 'I like apples very much', type: 'en_sentence' }],
  ['I like aples very much']
)
check(r3.items[0].isCorrect, false, '英文句 aples 错')
checkTrue(Array.isArray(r3.items[0].wordDiff), 'wordDiff 存在')
const diff = r3.items[0].wordDiff
check(diff.length, 5, '词级 diff 长度 5')
check(diff[0].ok, true, 'I 对')
check(diff[1].ok, true, 'like 对')
check(diff[2].ok, false, 'aples 错')
check(diff[2].expected, 'apples', 'aples 期望 apples')
check(diff[3].ok, true, 'very 对')
check(diff[4].ok, true, 'much 对')

console.log('\ngradeSession - 答卷顺序无关:')
const r4 = gradeSession(
  [
    { content: 'apple', type: 'en_word' },
    { content: 'banana', type: 'en_word' },
    { content: 'cat', type: 'en_word' }
  ],
  ['cat banana apple']
)
check(r4.score.correct, 3, '乱序也算对')

console.log('\ngradeSession - 答卷上的序号:')
const r5 = gradeSession(
  [{ content: 'apple', type: 'en_word' }],
  ['1. apple']
)
check(r5.items[0].isCorrect, true, '"1. apple" 去序号后匹配')

console.log('\nwordLevelDiff - 直接调用:')
const wd = wordLevelDiff('I like apples', 'I like aples')
check(wd.length, 3, '3 个词')
check(wd[2], { word: 'aples', ok: false, expected: 'apples' }, '词级 diff 第三项')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
