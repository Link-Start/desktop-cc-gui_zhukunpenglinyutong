# Promote shared Markdown renderer

## OpenSpec
- Change: `openspec/changes/promote-shared-markdown-renderer`
- Roadmap: Phase 6A

## 目标
- Markdown implementation/runtime/support 进入 `src/markdown/**` neutral owner。
- 提取 local resource、heavy islands 与 streaming scheduler owners。
- external callers 使用 canonical path；messages old path 仅 compatibility re-export。

## 验收
- shared Markdown 不反向依赖 messages private modules。
- lazy/fullscreen/math/tool-call/file-link/outline/streaming behavior 无漂移。
- Markdown/messages/external smoke、worker、build、bundle、boundary gates 通过。
