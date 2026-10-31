// pages/dictation/index/index.test.js
// 验证主页拖拽排序的核心算法与滚动布局约定。
//
// 背景：主页改成三段式布局（Page 不滚动 + scroll-view 独立滚动），
// 滚动条才不会压到底部固定的 Tab 栏上。拖拽改用 scroll-view 的
// binddragstart/binddragging/binddragend（enhanced 模式专属）。
//
// 运行：node miniprogram/pages/dictation/index/index.test.js

const fs = require('fs')
const path = require('path')

const PAGE_DIR = __dirname
const WXML = path.join(PAGE_DIR, 'index.wxml')
const WXSS = path.join(PAGE_DIR, 'index.wxss')
const JS = path.join(PAGE_DIR, 'index.js')

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    const r = fn()
    if (r === true) { console.log(`  ✓ ${name}`); passed++ }
    else { console.log(`  ✗ ${name}${r ? ' → ' + r : ''}`); failed++ }
  } catch (err) {
    console.log(`  ✗ ${name} → 异常: ${err && err.message}`)
    failed++
  }
}

const wxmlRaw = fs.readFileSync(WXML, 'utf8')
const wxssRaw = fs.readFileSync(WXSS, 'utf8')
const js = fs.readFileSync(JS, 'utf8')

// 去掉注释后再做「是否存在某属性/选择器」的判断，
// 否则注释里提到 catchtouchmove / position:fixed 会造成误报。
const wxml = wxmlRaw.replace(/<!--[\s\S]*?-->/g, '')
const wxss = wxssRaw.replace(/\/\*[\s\S]*?\*\//g, '')
const appWxss = fs.readFileSync(
  path.join(PAGE_DIR, '..', '..', '..', 'app.wxss'), 'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '')

// ── 1. 滚动容器：回弹 ──
console.log('\n滚动容器（回弹）:')

check('scroll-view 开启了 enhanced（bounces 的前置条件）', () => {
  return /<scroll-view[^>]*enhanced="\{\{\s*true\s*\}\}"/s.test(wxml) ||
    '未开启 enhanced —— bounces / fast-deceleration / show-scrollbar 都不会生效'
})

check('开启 bounces（iOS 边界回弹）', () => {
  return /bounces="\{\{\s*true\s*\}\}"/.test(wxml) || '未开启 bounces'
})

check('开启 enable-back-to-top（iOS 点状态栏回顶部）', () => {
  return /enable-back-to-top="\{\{\s*true\s*\}\}"/.test(wxml) || '未开启 enable-back-to-top'
})

check('scroll-y 绑定到 !dragId（拖拽时关掉滚动）', () => {
  return /scroll-y="\{\{\s*!dragId\s*\}\}"/.test(wxml) || 'scroll-y 未绑定 !dragId'
})

// ── 2. 滚动容器：滑得到顶部 ──
console.log('\n滚动容器（滑得到顶部）:')

check('列表项没有用 catchtouchmove（会阻止手势冒泡导致滚不动）', () => {
  if (/catchtouchmove/.test(wxml)) {
    const m = wxml.match(/<view[^>]*catchtouchmove[^>]*>/)
    return '仍存在 catchtouchmove → ' + (m ? m[0].slice(0, 60) : '')
  }
  return true
})

check('列表项用 bindtouchmove（能冒泡到 scroll-view → 列表项上也能滑动）', () => {
  return /bindtouchmove="onTouchMove"/.test(wxml) || '未绑定 bindtouchmove'
})

check('根节点不是 position:fixed（会让 scroll-view 滚动位置异常）', () => {
  const m = wxss.match(/\.dictation-index\s*\{[^}]*\}/)
  if (!m) return '未找到 .dictation-index'
  if (/position:\s*fixed/.test(m[0])) return '仍用 position:fixed'
  return true
})

check('根节点用 height:100%（配合 page-meta 收敛 page 高度）', () => {
  const m = wxss.match(/\.dictation-index\s*\{[^}]*\}/)
  if (!m) return '未找到 .dictation-index'
  return /height:\s*100%/.test(m[0]) || '未设 height:100%'
})

check('page-meta 禁掉了 page 自身滚动（避免双滚动条）', () => {
  const m = wxml.match(/<page-meta[^>]*>/)
  if (!m) return '未找到 page-meta'
  return /overflow:\s*hidden/.test(m[0]) || 'page-meta 未设 overflow:hidden'
})

check('page-meta 把 page 高度收敛到内容区', () => {
  const m = wxml.match(/<page-meta[^>]*>/)
  if (!m) return '未找到 page-meta'
  return /height:\s*100%/.test(m[0]) || 'page-meta 未设 height:100%'
})

check('scroll-view 用 flex:1 + height:0 填满剩余高度', () => {
  const m = wxss.match(/\.dictation-scroll\s*\{[^}]*\}/)
  if (!m) return '未找到 .dictation-scroll'
  if (!/flex:\s*1/.test(m[0])) return '缺 flex:1'
  if (!/height:\s*0/.test(m[0])) return '缺 height:0（只写 flex:1 时初始高度是内容高度，会导致不滚动）'
  return true
})

// ── 3. 拖拽事件源 ──
console.log('\n拖拽事件源:')

check('绑定了 binddragstart', () => {
  return /binddragstart="onDragStart"/.test(wxml) || '未绑定 binddragstart'
})

check('绑定了 binddragging', () => {
  return /binddragging="onDragMove"/.test(wxml) || '未绑定 binddragging'
})

check('绑定了 binddragend', () => {
  return /binddragend="onDragEnd"/.test(wxml) || '未绑定 binddragend'
})

check('长按仍用 bindlongpress 激活拖拽', () => {
  return /bindlongpress="onLongPress"/.test(wxml) || '未绑定 bindlongpress'
})

check('列表项绑定了 bindtouchend（通路 A 的结束事件）', () => {
  return /bindtouchend="onTouchEnd"/.test(wxml) || '未绑定 bindtouchend'
})

// ── 4. 拖拽逻辑守卫 ──
console.log('\n拖拽逻辑守卫:')

check('onDragMove 有 dragId 守卫（普通滚动不触发 setData）', () => {
  const m = js.match(/onDragMove\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onDragMove'
  const body = m[0]
  if (!/if\s*\(\s*!this\.data\.dragId\s*\)\s*return/.test(body)) {
    return '缺少 dragId 守卫 —— 普通滚动时会持续 setData'
  }
  return true
})

check('onTouchMove 有 dragId 守卫（普通滚动不触发 setData）', () => {
  const m = js.match(/onTouchMove\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onTouchMove'
  const body = m[0]
  if (!/if\s*\(\s*!this\.data\.dragId\s*\)\s*return/.test(body)) {
    return '缺少 dragId 守卫'
  }
  return true
})

check('onDragEnd 有 dragId 守卫（普通滚动结束不触发 persist）', () => {
  const m = js.match(/onDragEnd\s*\(\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onDragEnd'
  return /if\s*\(\s*!this\.data\.dragId\s*\)\s*return/.test(m[0]) ||
    /_finishDrag/.test(m[0]) || '缺少 dragId 守卫'
})

check('_finishDrag 有 dragId 守卫（普通滚动结束不误持久化）', () => {
  const m = js.match(/_finishDrag\s*\(\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 _finishDrag'
  return /if\s*\(\s*!this\.data\.dragId\s*\)\s*return/.test(m[0]) || '缺少 dragId 守卫'
})

check('onDragStart 存在且有 dragId 守卫', () => {
  const m = js.match(/onDragStart\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onDragStart'
  return /if\s*\(\s*!this\.data\.dragId\s*\)\s*return/.test(m[0]) || '缺少 dragId 守卫'
})

check('onLongPress 记录了起点坐标与原始索引', () => {
  const m = js.match(/onLongPress\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onLongPress'
  const b = m[0]
  if (!/_dragStartY/.test(b)) return '未记录 _dragStartY'
  if (!/_dragStartIndex/.test(b)) return '未记录 _dragStartIndex'
  if (!/_orderIds/.test(b)) return '未记录 _orderIds'
  return true
})

check('onDragStart 重新校准了起点（长按后手指已移动）', () => {
  const m = js.match(/onDragStart\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 onDragStart'
  return /_dragStartY\s*=/.test(m[0]) || 'onDragStart 未重新校准 _dragStartY'
})

check('_touchClientY 辅助函数存在（多端字段兜底）', () => {
  return /function _touchClientY/.test(js) || '缺少 _touchClientY'
})

check('_touchClientY 依次尝试 touches / changedTouches', () => {
  const m = js.match(/function _touchClientY\s*\(e\)\s*\{[\s\S]*?\n\}/)
  if (!m) return '未找到 _touchClientY 函数体'
  const b = m[0]
  if (!/e\.touches/.test(b)) return '未尝试 e.touches'
  if (!/e\.changedTouches/.test(b)) return '未尝试 e.changedTouches'
  return true
})

check('拖拽移动时索引被夹在合法范围', () => {
  // 计算逻辑已抽到 _applyDrag（onTouchMove / onDragMove 共用）
  const m = js.match(/_applyDrag\s*\(clientY\)\s*\{[\s\S]*?\n  \}/)
  if (!m) return '未找到 _applyDrag'
  const b = m[0]
  if (!/targetIndex\s*<\s*0/.test(b)) return '未处理 targetIndex < 0'
  if (!/targetIndex\s*>\s*total\s*-\s*1/.test(b)) return '未处理 targetIndex > total-1'
  return true
})

check('onTouchMove 与 onDragMove 共用 _applyDrag（双通路不叠加位移）', () => {
  const a = js.match(/onTouchMove\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  const b = js.match(/onDragMove\s*\(e\)\s*\{[\s\S]*?\n  \}/)
  if (!a) return '未找到 onTouchMove'
  if (!b) return '未找到 onDragMove'
  if (!/_applyDrag/.test(a[0])) return 'onTouchMove 未调用 _applyDrag'
  if (!/_applyDrag/.test(b[0])) return 'onDragMove 未调用 _applyDrag'
  return true
})

check('_finishDrag 被 onTouchEnd 与 onDragEnd 共用', () => {
  const a = js.match(/onTouchEnd\s*\(\)\s*\{[\s\S]*?\n  \}/)
  const b = js.match(/onDragEnd\s*\(\)\s*\{[\s\S]*?\n  \}/)
  if (!a) return '未找到 onTouchEnd'
  if (!b) return '未找到 onDragEnd'
  if (!/_finishDrag/.test(a[0])) return 'onTouchEnd 未调用 _finishDrag'
  if (!/_finishDrag/.test(b[0])) return 'onDragEnd 未调用 _finishDrag'
  return true
})

// ── 5. 空清单也要有回弹 ──
console.log('\n空清单回弹:')

check('内容区设置了 min-height（内容永远比容器高 → 可拉可弹）', () => {
  const m = wxml.match(/<view class="dictation-content"[^>]*>/)
  if (!m) return '未找到 .dictation-content'
  return /min-height/.test(m[0]) || '未设置 min-height'
})

check('min-height 绑定了 scrollMinHeight（JS 实测容器高度 + 余量）', () => {
  const m = wxml.match(/<view class="dictation-content"[^>]*>/)
  if (!m) return '未找到 .dictation-content'
  return /scrollMinHeight/.test(m[0]) || '未绑定 scrollMinHeight'
})

check('JS 实测滚动容器高度（_measureScrollMinHeight）', () => {
  return /_measureScrollMinHeight/.test(js) || '缺少 _measureScrollMinHeight'
})

check('BOUNCE_EXTRA_RPX 常量已定义', () => {
  return /BOUNCE_EXTRA_RPX\s*=\s*\d+/.test(js) || '缺少 BOUNCE_EXTRA_RPX'
})

check('BOUNCE_EXTRA_RPX 值合理（40–100rpx：够拉出弹性又不与 padding 叠加出大片空白）', () => {
  const m = js.match(/BOUNCE_EXTRA_RPX\s*=\s*(\d+)/)
  if (!m) return '缺少 BOUNCE_EXTRA_RPX'
  const v = Number(m[1])
  if (v < 40) return `${v}rpx 太小，回弹几乎感觉不到`
  if (v > 100) return `${v}rpx 太大 —— min-height 与 padding-bottom 叠加，空清单时底部大片空白`
  return true
})

// ── 6. 不要悬浮按钮 ──
console.log('\n不要悬浮按钮:')

check('没有悬浮「开始听写」按钮（会出现两个按钮）', () => {
  if (/floating-start/.test(wxml)) return 'wxml 里仍有 floating-start'
  if (/floating-start/.test(wxss)) return 'wxss 里仍有 floating-start 样式'
  if (/showFloatingBtn/.test(js)) return 'js 里仍有 showFloatingBtn'
  if (/floating-start/.test(js)) return 'js 里仍有 floating-start'
  return true
})

check('没有 scrolltolower / scrolltoupper 绑定（min-height 恒定溢出会让它必然触发）', () => {
  if (/scrolltolower/.test(wxml)) return '仍绑定 scrolltolower'
  if (/scrolltoupper/.test(wxml)) return '仍绑定 scrolltoupper'
  if (/onScrollToLower/.test(js)) return 'js 里仍有 onScrollToLower'
  if (/onScrollToUpper/.test(js)) return 'js 里仍有 onScrollToUpper'
  return true
})

check('没有 lower-threshold 配置（无悬浮按钮就不需要）', () => {
  return !/lower-threshold/.test(wxml) || '仍设置 lower-threshold'
})

// ── 7. 底部留白 ──
console.log('\n底部留白:')

check('全局 .has-tab-bar 不再重复预留「主按钮」高度', () => {
  const m = appWxss.match(/\.has-tab-bar\s*\{[^}]*\}/)
  if (!m) return '未找到 .has-tab-bar'
  const body = m[0]
  const pm = body.match(/padding-bottom:\s*calc\(([^)]+)\)/)
  if (!pm) return '未找到 padding-bottom'
  // 只应含 Tab 栏高度 + 余量 + safe-area，不该再有 96rpx 的主按钮
  if (/96rpx/.test(pm[1])) return '仍含 96rpx（主按钮在内容流里，不该重复预留）'
  return true
})

check('主页不再使用 has-tab-bar（改用 flex 布局，Tab 栏是兄弟节点）', () => {
  if (/has-tab-bar/.test(wxml)) return '主页仍引用 has-tab-bar'
  return true
})

check('主页内容区有底部视觉余量', () => {
  const m = wxss.match(/\.dictation-content\s*\{[^}]*\}/)
  if (!m) return '未找到 .dictation-content'
  return /padding-bottom/.test(m[0]) || '缺 padding-bottom'
})

check('底部间距计入 Tab 栏高度 + safe-area（滚到底时最后一行不被 Tab 遮住）', () => {
  const m = wxss.match(/\.dictation-content\s*\{[^}]*\}/)
  if (!m) return '未找到 .dictation-content'
  const pm = m[0].match(/padding-bottom:\s*calc\((.+)\);/)
  if (!pm) return 'padding-bottom 未用 calc()'
  if (!/env\(safe-area-inset-bottom\)/.test(pm[1])) return '未计入 safe-area-inset-bottom'
  const num = parseInt(pm[1], 10)
  // Tab 栏可视区 110rpx，内容下方至少要留这么多才看得见最后一行
  if (!(num >= 150)) return `仅 ${num}rpx，会被 Tab 栏遮住（Tab 栏 110rpx + 余量）`
  return true
})

check('BOUNCE_EXTRA_RPX 保持小值（与 padding-bottom 叠加会产生大片空白）', () => {
  const m = js.match(/BOUNCE_EXTRA_RPX\s*=\s*(\d+)/)
  if (!m) return '缺少 BOUNCE_EXTRA_RPX'
  const v = Number(m[1])
  if (v > 100) return `${v}rpx 太大 —— min-height 撑起的高度会叠加在 padding 之上，空清单时底部大片空白`
  return true
})

// ── 汇总 ──
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
