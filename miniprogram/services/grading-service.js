// services/grading-service.js
//
// 判分逻辑（来自 docs/01-PRD.md 第 4 节、docs/04-服务集成.md 第 4 节）：
//   - normalize：转小写、去标点、压缩空格
//   - gradeSession：对清单中每条内容，看是否在 OCR 合并文本里能找到
//   - wordLevelDiff：英文句不匹配时做词级 diff，标记哪些词错
//
// 此模块纯逻辑，在小程序 + node 测试中都能跑。

const RE_PUNCT = /[.,!?;:'"()。，！？；：、""''《》【】「」]/g

function normalize(text) {
  if (text == null) return ''
  return String(text)
    .toLowerCase()
    .replace(RE_PUNCT, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 整次听写判分
 * @param {Array<{content:string, type:string}>} list - 标准答案清单
 * @param {Array<string>} ocrTexts - OCR 返回的文字块数组
 * @returns {{ score:{correct,total,rate}, items: Array }}
 */
function gradeSession(list, ocrTexts) {
  // 1. OCR 文字块去序号,过滤空
  const cleanedBlocks = (ocrTexts || []).map(stripSequenceMarker).filter(b => normalize(b).length > 0)
  const normalizedFull = normalize(cleanedBlocks.join(' '))

  // 2. isCorrect 判断:按 PRD 4.1 "无顺序匹配"
  const stdList = list || []
  const items = stdList.map(item => {
    const standardNormalized = normalize(item.content)
    const isCorrect = standardNormalized.length > 0 && normalizedFull.indexOf(standardNormalized) >= 0
    return { content: item.content, type: item.type, isCorrect }
  })

  // 3. userAnswer 匹配(目的:OCR 识别到的内容尽量都显示)
  // Phase A: 子串匹配(非互斥) — 多条 std 可共用同一 block(应对 OCR 大块场景)
  items.forEach((it) => {
    const stdN = normalize(it.content)
    if (!stdN) return
    for (let i = 0; i < cleanedBlocks.length; i++) {
      if (normalize(cleanedBlocks[i]).indexOf(stdN) >= 0) {
        it.userAnswer = cleanedBlocks[i]
        return
      }
    }
  })

  // Phase B: 未匹配的 std → 从"长度合适"的 block 中找 jaccard 最高
  //   长度合适: block 长度 >= std 长度 * 0.7,防止句子被短词错配
  //   找不到合适长度时,扩到所有 block
  items.forEach(it => {
    if (it.userAnswer) return
    const stdN = normalize(it.content)
    if (!stdN) return
    const minLen = Math.ceil(stdN.length * 0.7)
    let pool = cleanedBlocks.filter(b => normalize(b).length >= minLen)
    if (pool.length === 0) pool = cleanedBlocks
    let best = null
    let bestScore = -1
    for (const block of pool) {
      const score = jaccard(stdN, normalize(block))
      if (score > bestScore) {
        bestScore = score
        best = block
      }
    }
    if (best && bestScore > 0) {
      it.userAnswer = best
    }
  })

  // 4. 英文句子错的话做词级 diff
  items.forEach(it => {
    if (!it.isCorrect && it.userAnswer && it.type === 'en_sentence') {
      it.wordDiff = wordLevelDiff(it.content, it.userAnswer)
    }
  })

  const correct = items.filter(i => i.isCorrect).length
  const total = items.length
  const rate = total > 0 ? correct / total : 0

  return {
    score: { correct, total, rate },
    items
  }
}

/**
 * 词级 diff（仅英文句子用）
 * 实现方式：LCS 对齐两个词序列，标出删除/替换/匹配。
 * @param {string} standard
 * @param {string} userAnswer
 * @returns {Array<{word, ok, expected?}>}
 */
function wordLevelDiff(standard, userAnswer) {
  const stdWords = tokenize(standard)
  const usrWords = tokenize(userAnswer)
  if (stdWords.length === 0) return []

  // 经典 LCS DP 表
  const m = stdWords.length
  const n = usrWords.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (stdWords[i - 1].toLowerCase() === usrWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯 LCS 得到对齐
  const ops = [] // 每项 { type: 'match'|'del'|'ins'|'sub', stdWord?, usrWord? }
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (stdWords[i - 1].toLowerCase() === usrWords[j - 1].toLowerCase()) {
      ops.unshift({ type: 'match', stdWord: stdWords[i - 1], usrWord: usrWords[j - 1] })
      i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ type: 'del', stdWord: stdWords[i - 1] })
      i--
    } else {
      ops.unshift({ type: 'ins', usrWord: usrWords[j - 1] })
      j--
    }
  }
  while (i > 0) { ops.unshift({ type: 'del', stdWord: stdWords[i - 1] }); i-- }
  while (j > 0) { ops.unshift({ type: 'ins', usrWord: usrWords[j - 1] }); j-- }

  // 把相邻的 del+ins 合并为 sub（"替换"）—— 用户视角更友好
  const merged = []
  for (let k = 0; k < ops.length; k++) {
    const cur = ops[k]
    const next = ops[k + 1]
    if (cur.type === 'del' && next && next.type === 'ins') {
      merged.push({ type: 'sub', stdWord: cur.stdWord, usrWord: next.usrWord })
      k++
    } else if (cur.type === 'ins' && next && next.type === 'del') {
      merged.push({ type: 'sub', stdWord: next.stdWord, usrWord: cur.usrWord })
      k++
    } else {
      merged.push(cur)
    }
  }

  // 输出格式：从用户答卷视角展示
  //   match → { word: usrWord, ok: true }
  //   sub   → { word: usrWord, ok: false, expected: stdWord }
  //   ins   → { word: usrWord, ok: false, extra: true }
  //   del   → { word: '', ok: false, expected: stdWord, missing: true }
  return merged.map(op => {
    switch (op.type) {
      case 'match': return { word: op.usrWord, ok: true }
      case 'sub':   return { word: op.usrWord, ok: false, expected: op.stdWord }
      case 'ins':   return { word: op.usrWord, ok: false, extra: true }
      case 'del':   return { word: '', ok: false, expected: op.stdWord, missing: true }
    }
  })
}

// ── 内部工具 ──

function tokenize(text) {
  return String(text || '')
    .replace(RE_PUNCT, ' ')
    .split(/\s+/)
    .filter(s => s.length > 0)
}

function stripSequenceMarker(text) {
  // "1. apple" → "apple"； "（2）oranges" → "oranges"； "①hello" → "hello"
  return String(text || '')
    .replace(/^\s*[（(]?\d+[）)]\s*[.、)]?\s*/, '')
    .replace(/^\s*[①-⑩]\s*/, '')
    .trim()
}

function jaccard(a, b) {
  // 取 char bigram 集合的 Jaccard 相似度
  const sa = bigrams(a)
  const sb = bigrams(b)
  if (sa.size === 0 && sb.size === 0) return 0
  let inter = 0
  for (const g of sa) if (sb.has(g)) inter++
  const union = sa.size + sb.size - inter
  return union > 0 ? inter / union : 0
}

function bigrams(s) {
  const set = new Set()
  if (!s || s.length < 2) {
    if (s) set.add(s)
    return set
  }
  for (let i = 0; i < s.length - 1; i++) set.add(s.substr(i, 2))
  return set
}

module.exports = { normalize, gradeSession, wordLevelDiff }
