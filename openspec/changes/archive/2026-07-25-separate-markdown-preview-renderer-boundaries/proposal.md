## Why

Markdown file preview 当前以 `FileMarkdownPreviewFast` 作为 production router，但该文件直接依赖
1581 行、名称仍像默认实现的 `FileMarkdownPreview`。调用方无法从 import 判断拿到的是 router
还是 rich renderer，fast/rich/fallback 的 ownership 也集中在反向命名的 wrapper 中，增加后续
独立演进和移除 legacy 路径的风险。

## What Changes

- `FileMarkdownPreviewRouter.tsx` 收敛为唯一 canonical router。
- 原 rich ReactMarkdown implementation 在 baseline-tracked `FileMarkdownPreview.tsx` 中显式导出为 `FileMarkdownPreviewRich`。
- `FileViewBody` 改为只 import canonical router。
- `FileMarkdownPreviewFast.tsx` 降为无逻辑 compatibility re-export。
- 保持 fast profile、rich profile、local-image fallback、runtime cache reset 行为不变。

## Capabilities

### New Capabilities

- `file-markdown-preview-renderer-boundaries`: 定义 canonical router、rich implementation 与兼容入口边界。

## Impact

- Production router：`src/features/files/components/FileMarkdownPreviewRouter.tsx`
- Rich implementation：`src/features/files/components/FileMarkdownPreview.tsx`
- Compatibility entry：`src/features/files/components/FileMarkdownPreviewFast.tsx`
- Consumer：`src/features/files/components/FileViewBody.tsx`
- Focused Markdown/FileView tests；无新增 dependency
