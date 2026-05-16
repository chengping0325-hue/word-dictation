// pages/dictation/grading/index.js
// Phase 2 阶段：用 setTimeout 模拟 OCR + 判分耗时，生成假结果。
// Phase 4 阶段：替换为 ocr.recognize + grading.gradeSession。

const FAKE_DELAY_MS = 2500

Page({
  data: {
    steps: [
      { label: '图片上传完成', state: 'done' },
      { label: '识别手写内容(含句子)...', state: 'active' },
      { label: '逐词对比判分', state: 'pending' }
    ]
  },

  onLoad() {
    const app = getApp()
    const cd = app.globalData.currentDictation
    if (!cd || !Array.isArray(cd.list) || cd.list.length === 0) {
      wx.showToast({ title: '没有听写记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }

    // 半秒后让 step 2 进入完成态、step 3 进入进行态（让用户感觉有进展）
    this._timer1 = setTimeout(() => {
      this.setData({
        steps: [
          { label: '图片上传完成', state: 'done' },
          { label: '识别手写内容(含句子)', state: 'done' },
          { label: '逐词对比判分', state: 'active' }
        ]
      })
    }, FAKE_DELAY_MS / 2)

    // 完成后生成假结果，跳到结果页
    this._timer2 = setTimeout(() => {
      const result = generateFakeResult(cd.list)
      app.globalData.currentResult = result
      wx.redirectTo({ url: '/pages/dictation/result/index' })
    }, FAKE_DELAY_MS)
  },

  onUnload() {
    if (this._timer1) clearTimeout(this._timer1)
    if (this._timer2) clearTimeout(this._timer2)
  }
})

// 生成假判分结果（Phase 2 用，Phase 4 会被真正的 gradeSession 替换）
function generateFakeResult(list) {
  const items = list.map(item => {
    const isCorrect = Math.random() > 0.25 // ~75% 正确率
    const out = {
      content: item.content,
      type: item.type,
      isCorrect
    }
    if (!isCorrect) {
      out.userAnswer = fakeWrongAnswer(item.content)
    }
    return out
  })
  const correct = items.filter(i => i.isCorrect).length
  const total = items.length
  return {
    score: { correct, total, rate: total > 0 ? correct / total : 0 },
    items,
    mode: 'ocr'
  }
}

function fakeWrongAnswer(text) {
  // 给定文本造一个"像错了"的版本
  if (!text || text.length < 2) return text + '_'
  const mid = Math.floor(text.length / 2)
  return text.slice(0, mid) + text.slice(mid + 1) // 删掉中间一个字符
}
