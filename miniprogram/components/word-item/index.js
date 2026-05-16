// 列表中的一条单词/句子
// item: { content, type } 必填，其它字段（如 isCorrect、userAnswer、wordDiff）可选，用于复用到判分结果/单词本
// showDelete: 是否显示右侧 ×（清单页用 true，单词本用 false）
// showDrag: 是否显示左侧拖拽提示（清单页用 true）
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    item: {
      type: Object,
      value: { content: '', type: 'en_word' }
    },
    showDelete: {
      type: Boolean,
      value: false
    },
    showDrag: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    onDelete() {
      this.triggerEvent('delete', { item: this.data.item })
    }
  }
})
