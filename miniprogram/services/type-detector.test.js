// 跑法：node miniprogram/services/type-detector.test.js
const { detectType, getLang, getTypeLabel } = require('./type-detector')

const cases = [
  // ── docs/05-开发指令.md 第 2.1 节列的 6 个核心 case ──
  ['apple',                    'en_word'],
  ["don't",                    'en_word'],
  ['good morning',             'en_sentence'],
  ['苹果',                      'cn_word'],
  ['床前明月光,',                'cn_sentence'],
  ['我喜欢 apple',              'cn_sentence'],

  // ── docs/01-PRD.md 第 3.2 节边界 ──
  ['I like apples.',           'en_sentence'],
  ['床',                        'cn_word'],
  ['床前明月光,疑是地上霜。',     'cn_sentence'],
  ['1234',                      'en_word'],

  // ── 自补充边界 ──
  ['   apple   ',               'en_word'],       // 前后空格
  ['',                          'en_word'],       // 空串走默认
  ['hello world!',              'en_sentence'],   // 含半角标点 + 空格 → 英文句
  ['12345678',                  'en_word'],       // 长度大但无中文，仍为英文词
  ['I am 11 years old',         'en_sentence']
]

const langCases = [
  ['en_word',      'en_US'],
  ['en_sentence',  'en_US'],
  ['cn_word',      'zh_CN'],
  ['cn_sentence',  'zh_CN']
]

const labelCases = [
  ['en_word',      'EN'],
  ['cn_word',      '中'],
  ['en_sentence',  'EN 句'],
  ['cn_sentence',  '中 句']
]

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (actual === expected) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label} expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`)
  }
}

console.log('detectType:')
for (const [input, expected] of cases) {
  check(detectType(input), expected, `detectType(${JSON.stringify(input)})`)
}

console.log('\ngetLang:')
for (const [input, expected] of langCases) {
  check(getLang(input), expected, `getLang(${JSON.stringify(input)})`)
}

console.log('\ngetTypeLabel:')
for (const [input, expected] of labelCases) {
  check(getTypeLabel(input), expected, `getTypeLabel(${JSON.stringify(input)})`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
