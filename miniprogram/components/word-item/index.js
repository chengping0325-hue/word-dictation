// 列表中的一条单词/句子
// item: { content, type } 必填
// showDelete: 是否显示右侧 ×
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
    }
  },
  methods: {
    onDelete() {
      this.triggerEvent('delete', { item: this.data.item })
    }
  }
})
