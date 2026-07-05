## Context

把 UI 字体、Geist 本地字体、字号变量和 Markdown 阅读样式整理成稳定的阅读体验。

这组提交看起来是 typography polish，但实际影响的是所有长文本阅读面：conversation Markdown、file preview、Spec Hub、settings label、sidebar text density。字体一旦没有规范，后续每个 UI 细节都会用自己的字号、line-height、font-family 解决局部问题，最后形成不可维护的视觉噪声。

## Decisions

- UI chrome 追求紧凑、可扫描；Markdown prose 追求长时间阅读舒适。
- 字体资源必须 local bundled，不依赖 remote font。
- 字体变量是基础设施，不能在 feature 内零散硬编码。

## Risks And Guardrails

- 全局字体变化可能影响按钮、tab、settings row 的高度。
- Markdown 行距过紧会影响长回答审阅；过松会浪费 conversation viewport。
- 防线：字体变化必须同时看 UI chrome 和 Markdown reading surface。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-typography-font-and-markdown-readability --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
