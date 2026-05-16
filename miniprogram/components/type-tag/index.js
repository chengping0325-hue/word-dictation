// 类型标签组件
// type: 'en_word' | 'cn_word' | 'en_sentence' | 'cn_sentence'
const TYPE_TO_LABEL = {
  en_word: 'EN',
  cn_word: '中',
  en_sentence: 'EN 句',
  cn_sentence: '中 句'
}

const TYPE_TO_CLASS = {
  en_word: 'tag-en',
  cn_word: 'tag-cn',
  en_sentence: 'tag-en-sent',
  cn_sentence: 'tag-cn-sent'
}

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    type: {
      type: String,
      value: 'en_word'
    }
  },
  data: {
    label: 'EN',
    cls: 'tag-en'
  },
  observers: {
    type(val) {
      this.setData({
        label: TYPE_TO_LABEL[val] || 'EN',
        cls: TYPE_TO_CLASS[val] || 'tag-en'
      })
    }
  },
  lifetimes: {
    attached() {
      const val = this.data.type
      this.setData({
        label: TYPE_TO_LABEL[val] || 'EN',
        cls: TYPE_TO_CLASS[val] || 'tag-en'
      })
    }
  }
})
