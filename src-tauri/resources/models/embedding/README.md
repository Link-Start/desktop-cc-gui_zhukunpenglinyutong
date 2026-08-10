# Embedding Model Directory

模型文件**运行时按需下载**到 `~/.ccgui/models/embedding/`，由用户从记忆参考菜单触发。

## 开发者预下载

```bash
# 下载到 app data dir（应用自动检测）
bash scripts/download-embed-model.sh

# 或下载到 repo resources/（开发用）
bash scripts/download-embed-model.sh --dev
```

下载 `sentence-transformers/all-MiniLM-L6-v2`（384 维 · ~90MB ONNX + 0.5MB tokenizer · 中英文可用）。

## 模型查找优先级

1. 打包 resource_dir（bundle.resources，如有）
2. 开发态 `src-tauri/resources/models/embedding/`
3. 用户 `~/.ccgui/models/embedding/`（运行时下载目标）

## 模型未就绪时

应用自动降级为关键词匹配（lexical），记忆功能不受影响。
记忆参考菜单显示「下载本地语义模型」入口，点击后自动下载。
不会弹窗要求用户安装第三方软件。
