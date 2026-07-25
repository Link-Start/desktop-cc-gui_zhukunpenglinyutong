## Context

现有 `FileMarkdownPreviewFast` 实际承担 renderer router、outline state、fallback orchestration；
`FileMarkdownPreview` 实际是 rich ReactMarkdown renderer。名称与职责相反，production consumer
必须知道 wrapper 细节。

## Decision

### Canonical router

把现有 router 移到 `FileMarkdownPreview.tsx` 并导出：

- `FileMarkdownPreview`
- `FileMarkdownPreviewProps`

router 是 production 唯一入口，继续拥有 profile selection、fast fallback 与 outline。

### Explicit implementation

原 renderer 移到 `FileMarkdownPreviewRich.tsx` 并导出：

- `FileMarkdownPreviewRich`
- `FileMarkdownPreviewRichProps`
- rich runtime cache test reset

router 可以依赖 rich implementation；rich implementation 禁止反向依赖 router。

### Compatibility boundary

`FileMarkdownPreviewFast.tsx` 只 re-export canonical router 的旧 symbol，保护已有局部调用与
测试迁移，不复制 state/handler/render 逻辑。新 production code 禁止 import compatibility entry。

## Risks

- Rename 可能漏掉 test-only import：用 `rg` import graph 与 focused suite 验证。
- Cache reset symbol：由 canonical router re-export rich reset，保持现有测试 API。
- Bundle：不新增 eager dependency；只是重命名既有静态 graph。
