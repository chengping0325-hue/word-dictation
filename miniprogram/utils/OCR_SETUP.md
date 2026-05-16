# OCR 插件接入待办

在调用拍照识别功能前，需要做两步：

1. **在小程序后台添加插件**
   - 微信公众平台 → 小程序后台 → 设置 → 第三方设置 → 插件管理 → 添加插件
   - 搜索"OCR"找到合适插件（推荐"微信 OCR"或腾讯云提供的官方 OCR 插件），添加
   - 记下插件名称、版本号、appid

2. **在 app.json 声明插件**
   ```json
   "plugins": {
     "ocr-plugin": {
       "version": "<版本号，如 1.0.0>",
       "provider": "<插件 appid>"
     }
   }
   ```

3. **在 utils/ocr.js 启用插件调用**
   - 取消 `ocrPlugin = requirePlugin('ocr-plugin')` 的注释
   - 如果插件 API 不是 `generalOcr({ imgPath })`，调整 `recognizeWords` 中的调用

完成后，听写页"📷 拍照识别"和批改页"📷 拍照 / 从相册选择"都会调用此插件。
