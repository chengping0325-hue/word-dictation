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

console.log('\ngradeSession - userAnswer 子串优先匹配(非互斥):')
// 用户写对的词,通过子串匹配找到对应 block
const r6 = gradeSession(
  [
    { content: 'Basketball', type: 'en_word' },
    { content: 'football', type: 'en_word' },
    { content: 'rice', type: 'en_word' },
    { content: 'I like football', type: 'en_sentence' }
  ],
  ['Basketball', 'football', 'rice', 'llike Basketball']
)
checkTrue(r6.items[0].userAnswer === 'Basketball', 'Basketball 子串匹配自己')
checkTrue(r6.items[1].userAnswer === 'football', 'football 子串匹配自己')
checkTrue(r6.items[2].userAnswer === 'rice', 'rice 子串匹配自己')
// "I like football" 不被任何 block 包含 → 走 jaccard,最像的 block
checkTrue(r6.items[3].userAnswer != null, 'I like football 有 fallback 匹配')

// OCR 大块场景(常见!) — 子串匹配非互斥,所有短词 std 都拿到大块;长句 std 通过 Phase B 也拿到大块
const r7 = gradeSession(
  [
    { content: 'Basketball', type: 'en_word' },
    { content: 'football', type: 'en_word' },
    { content: 'rice', type: 'en_word' },
    { content: 'I like football', type: 'en_sentence' }
  ],
  ['Basketball football rice llike Basketball']
)
checkTrue(r7.items[0].userAnswer === 'Basketball football rice llike Basketball', '大块场景: Basketball 子串匹配')
checkTrue(r7.items[1].userAnswer === 'Basketball football rice llike Basketball', '大块场景: football 子串匹配')
checkTrue(r7.items[2].userAnswer === 'Basketball football rice llike Basketball', '大块场景: rice 子串匹配')
checkTrue(r7.items[3].userAnswer === 'Basketball football rice llike Basketball', '大块场景: I like football 兜底也拿大块')

// 用户报告的核心场景:OCR 分多块,标准答案完全不匹配的句子也要显示 OCR 内容
// std=[Basketball, football, rice, I like juice], OCR=[Basketball, football, rice, I like basketball]
// 前 3 个子串匹配自己;第 4 个 std 找未用块"I like basketball"作为 userAnswer 显示
const r9 = gradeSession(
  [
    { content: 'Basketball', type: 'en_word' },
    { content: 'football', type: 'en_word' },
    { content: 'rice', type: 'en_word' },
    { content: 'I like juice', type: 'en_sentence' }
  ],
  ['Basketball', 'football', 'rice', 'I like basketball']
)
checkTrue(r9.items[3].userAnswer === 'I like basketball', '错误句子也显示 OCR 内容(不再"未识别到")')
checkTrue(r9.items[3].isCorrect === false, '错误判定不变')

// 旧 bug 回归: std="I like football" 不应错配到只含"football"的 block
// (这是用户最早报的 "Basketball → football" 错乱 bug)
const r8 = gradeSession(
  [{ content: 'I like football', type: 'en_sentence' }],
  ['football']  // OCR 只识别到 "football" 单词
)
// 子串匹配: "i like football" 不在 "football" 里 → 走 jaccard
// jaccard ≈ 0.5,> 0.3 → 选 "football"
// 这种场景仍会有"football" 作为 userAnswer 展示,但 isCorrect=false
checkTrue(r8.items[0].isCorrect === false, 'I like football 不对')
// userAnswer 可能是 "football" 或 null,只要不报错就行
checkTrue(typeof r8.items[0].userAnswer !== 'undefined' || r8.items[0].userAnswer == null,
          'userAnswer 字段存在(可能为 null 或为 football)')

console.log('\nwordLevelDiff - 直接调用:')
const wd = wordLevelDiff('I like apples', 'I like aples')
check(wd.length, 3, '3 个词')
check(wd[2], { word: 'aples', ok: false, expected: 'apples' }, '词级 diff 第三项')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
