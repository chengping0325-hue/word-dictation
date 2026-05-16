// services/grading-service.js
//
// Phase 2 阶段：只实现 normalize（用于添加时的"重复检测"）。
// Phase 4 阶段会补 gradeSession + wordLevelDiff。
//
// normalize 规则来自 docs/01-PRD.md 第 4.2 节：转小写、去标点、压缩空格。

function normalize(text) {
  if (text == null) return ''
  return String(text)
    .toLowerCase()
    .replace(/[.,!?;:'"()。，！？；：、""''《》【】「」]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = { normalize }
