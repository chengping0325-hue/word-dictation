// 布局回归测试：反馈页 + 单词本页
//
// 这两个页面都改过布局，容易被后续改动破坏：
//   反馈页  —— 二维码位置偏上、卡片左右留白、box-sizing
//   单词本  —— 三段式布局 + 顶部标题栏固定
//
// 运行：node miniprogram/pages/layout.test.js
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8')

let pass = 0
let fail = 0

function check(name, fn) {
  let result
  try {
    result = fn()
  } catch (e) {
    result = '抛出异常: ' + e.message
  }
  if (result === true) {
    pass++
    console.log('  ✓ ' + name)
  } else {
    fail++
    console.log('  ✗ ' + name + ' → ' + result)
  }
}

// ── 反馈页 ──
console.log('\n反馈页（二维码位置与留白）:')

// 读取时剥掉 CSS 注释，避免注释里的属性名干扰断言
const stripCssComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '')

const fbWxml = read('miniprogram/pages/feedback/index.wxml')
const fbWxss = stripCssComments(read('miniprogram/pages/feedback/index.wxss'))

check('二维码不在页面垂直居中（改为靠上排列）', () => {
  const m = fbWxss.match(/\.feedback-page\s*\{[^}]*\}/)
  if (!m) return '未找到 .feedback-page'
  if (/justify-content:\s*center/.test(m[0])) {
    return '仍是 justify-content:center —— 卡片会被推到屏幕中线，下方大片空白'
  }
  return true
})

check('反馈页有明确的上边距（padding-top 非 0）', () => {
  const m = fbWxss.match(/\.feedback-page\s*\{[^}]*\}/)
  if (!m) return '未找到 .feedback-page'
  const pm = m[0].match(/padding:\s*([^;]+);/)
  if (!pm) return '未设置 padding'
  const parts = pm[1].trim().split(/\s+/)
  const top = parseInt(parts[0], 10)
  if (!top) return `padding-top = ${top}，没有上边距`
  return true
})

check('卡片左右留出足够间距（页面 padding 左右 ≥ 48rpx）', () => {
  const m = fbWxss.match(/\.feedback-page\s*\{[^}]*\}/)
  if (!m) return '未找到 .feedback-page'
  const pm = m[0].match(/padding:\s*([^;]+);/)
  if (!pm) return '未设置 padding'
  const parts = pm[1].trim().split(/\s+/)
  // padding: 上 左右 下(+safe-area)
  const sides = parts[1]
  const v = parseInt(sides, 10)
  if (!(v >= 48)) return `左右 padding 仅 ${v}rpx，卡片离屏幕边缘太近`
  return true
})

check('.qr-card 显式声明 box-sizing:border-box', () => {
  const m = fbWxss.match(/\.qr-card\s*\{[^}]*\}/)
  if (!m) return '未找到 .qr-card'
  if (!/box-sizing:\s*border-box/.test(m[0])) {
    return '缺 box-sizing —— 小程序 wxss 默认 content-box，width:100% + padding 会溢出父容器'
  }
  return true
})

check('.qr-card 覆盖了 .card 的 margin（避免双重外边距）', () => {
  const m = fbWxss.match(/\.qr-card\s*\{[^}]*\}/)
  if (!m) return '未找到 .qr-card'
  if (!/margin:\s*0/.test(m[0])) {
    return '未覆盖 margin —— .card 自带 margin: 24rpx 32rpx 0 会与页面 padding 叠加'
  }
  return true
})

check('二维码有内衬框（提供左右留白的 padding 容器）', () => {
  if (!/qr-frame/.test(fbWxml)) return 'wxml 里没有 .qr-frame'
  const m = fbWxss.match(/\.qr-frame\s*\{[^}]*\}/)
  if (!m) return 'wxss 里没有 .qr-frame 样式'
  if (!/padding:/.test(m[0])) {
    return '.qr-frame 没有 padding —— 左右留白完全靠这个 padding 提供'
  }
  return true
})

check('内衬框背景为白色（不引入灰色色块）', () => {
  const m = fbWxss.match(/\.qr-frame\s*\{[^}]*\}/)
  if (!m) return '未找到 .qr-frame'
  const bm = m[0].match(/background:\s*([^;]+);/)
  if (!bm) return '.qr-frame 没有背景色声明'
  const c = bm[1].trim().toUpperCase()
  if (c !== '#FFF' && c !== '#FFFFFF' && c !== 'WHITE') {
    return `内衬框背景是 ${c} —— 应为白色，避免出现灰色色块`
  }
  return true
})

check('.qr-frame 用 flex + justify-content:center 保证二维码居中', () => {
  const m = fbWxss.match(/\.qr-frame\s*\{[^}]*\}/)
  if (!m) return '未找到 .qr-frame'
  if (!/display:\s*flex/.test(m[0])) return '不是 flex 容器'
  if (!/justify-content:\s*center/.test(m[0])) {
    return '缺 justify-content:center —— .qr-wrap 是固定宽度块级元素，父容器非 flex 时会左对齐'
  }
  return true
})

check('二维码图片用 widthFix 模式（防止点阵被拉伸变形）', () => {
  if (!/mode="widthFix"/.test(fbWxml)) return '未使用 mode="widthFix"'
  return true
})

check('二维码开启长按识别', () => {
  if (!/show-menu-by-longpress="\{\{true\s*\}\}"/.test(fbWxml)) {
    return '未开启 show-menu-by-longpress —— 长按只会弹「保存图片」'
  }
  return true
})

// ── 单词本页 ──
console.log('\n单词本页（顶部标题栏固定）:')

const nbWxml = read('miniprogram/pages/dictation/notebook/index.wxml')
const nbWxss = stripCssComments(read('miniprogram/pages/dictation/notebook/index.wxss'))
const nbJs = read('miniprogram/pages/dictation/notebook/index.js')

check('单词本用三段式布局（Page 不滚动，scroll-view 独立滚动）', () => {
  if (!/page-meta/.test(nbWxml)) return '没有 page-meta —— Page 自身会滚动，出现双滚动条'
  if (!/overflow:\s*hidden/.test(nbWxml)) return 'page-meta 未禁掉 Page 滚动'
  if (!/notebook-scroll/.test(nbWxml)) return '没有 scroll-view'
  return true
})

check('标题栏在 scroll-view 之外（固定在视口顶部，不随内容滚动）', () => {
  const navbarIdx = nbWxml.indexOf('notebook-navbar"')
  const scrollIdx = nbWxml.indexOf('notebook-scroll')
  if (navbarIdx < 0) return '未找到 notebook-navbar'
  if (scrollIdx < 0) return '未找到 notebook-scroll'
  if (navbarIdx > scrollIdx) return '标题栏在 scroll-view 内部 —— 会跟着内容滚走'
  return true
})

check('标题栏是 flex 布局的固定高度项（flex-shrink:0）', () => {
  const m = nbWxss.match(/\.notebook-navbar\s*\{[^}]*\}/)
  if (!m) return '未找到 .notebook-navbar'
  if (!/flex-shrink:\s*0/.test(m[0])) {
    return '缺 flex-shrink:0 —— 内容多时标题栏会被压缩'
  }
  return true
})

check('根容器用 height:100% + flex column + overflow:hidden', () => {
  const m = nbWxss.match(/\.notebook-root\s*\{[^}]*\}/)
  if (!m) return '未找到 .notebook-root'
  const b = m[0]
  if (!/display:\s*flex/.test(b)) return '不是 flex 容器'
  if (!/flex-direction:\s*column/.test(b)) return '不是纵向 flex'
  if (!/overflow:\s*hidden/.test(b)) return '缺 overflow:hidden —— Page 会跟着滚'
  return true
})

check('scroll-view 用 flex:1 + height:0（保证能滚动）', () => {
  const m = nbWxss.match(/\.notebook-scroll\s*\{[^}]*\}/)
  if (!m) return '未找到 .notebook-scroll'
  const b = m[0]
  if (!/flex:\s*1/.test(b)) return '缺 flex:1'
  if (!/height:\s*0/.test(b)) {
    return '缺 height:0 —— 只写 flex:1 时初始高度是内容高度，压缩不生效导致不滚动'
  }
  return true
})

check('scroll-view 开启 enhanced + bounces（有 iOS 回弹）', () => {
  if (!/enhanced="\{\{\s*true\s*\}\}"/.test(nbWxml)) return '未开启 enhanced'
  if (!/bounces="\{\{\s*true\s*\}\}"/.test(nbWxml)) {
    return '未开启 bounces —— bounces 必须配合 enhanced 才生效'
  }
  return true
})

check('内容区有 min-height（内容不足一屏时也能回弹 + 不吞 tap 事件）', () => {
  if (!/min-height:\s*\{\{\s*scrollMinHeight\s*\}\}px/.test(nbWxml)) {
    return '内容区未绑定 min-height: scrollMinHeight'
  }
  if (!/BOUNCE_EXTRA_RPX/.test(nbJs)) return 'js 里缺少 BOUNCE_EXTRA_RPX'
  return true
})

check('BOUNCE_EXTRA_RPX 保持小值（与 padding-bottom 叠加会产生大片空白）', () => {
  const m = nbJs.match(/BOUNCE_EXTRA_RPX\s*=\s*(\d+)/)
  if (!m) return '缺少 BOUNCE_EXTRA_RPX'
  const v = Number(m[1])
  if (v > 100) return `${v}rpx 太大 —— 空清单时底部会显得很长`
  return true
})

check('单词本仍使用 custom 导航栏（自绘标题，不显示返回箭头）', () => {
  const j = read('miniprogram/pages/dictation/notebook/index.json')
  if (!/navigationStyle.*custom/.test(j)) return '不是 custom 导航模式'
  return true
})

check('底部 Tab 栏仍渲染（且在 scroll-view 之外）', () => {
  if (!/dictation-tab-bar/.test(nbWxml)) return '缺少 tab-bar'
  const tabIdx = nbWxml.indexOf('dictation-tab-bar')
  const scrollEnd = nbWxml.lastIndexOf('</scroll-view>')
  if (tabIdx < scrollEnd) return 'Tab 栏在 scroll-view 内部 —— 会被内容顶起'
  return true
})

console.log(`\n通过 ${pass} / ${pass + fail}`)
if (fail > 0) {
  console.log('失败 ' + fail + ' 项')
  process.exit(1)
}
