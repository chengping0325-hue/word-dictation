// utils/time.js
// 日期格式化（"今天" / "昨天" / "2026年5月15日"）

function pad2(n) { return n < 10 ? '0' + n : '' + n }

/**
 * @param {Date|string|number} input 时间
 * @returns {string} "今天" | "昨天" | "2026年5月15日"
 */
function formatSessionDate(input) {
  const d = toDate(input)
  if (!d) return ''

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today - that) / 86400000)

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function formatTime(input) {
  const d = toDate(input)
  if (!d) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return input
  if (typeof input === 'number' || typeof input === 'string') {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  // 云数据库 serverDate 返回的可能是 { $date: { $numberLong: '...' } } 之类
  // 但前端 db.collection().get() 会自动转成 Date 对象,这里兜个底
  if (input && typeof input === 'object' && input.toDate) return input.toDate()
  return null
}

module.exports = { formatSessionDate, formatTime }
