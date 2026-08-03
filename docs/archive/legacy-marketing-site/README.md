---
type: index
status: deprecated
---

# Legacy marketing site retirement record

> **内容类型**：Decision Record
> **生命周期**：retired
> **退役日期**：2026-08-03
> **原路径**：`docs/index.html`、`docs/changelog.html`、`docs/styles.css`、`docs/assets/**`
> **替代入口**：[`../../../README.md`](../../../README.md)

旧静态站已退役，不再作为 GitHub Pages 或产品文档入口。

退役原因：

- 仓库没有对应 package script、Pages workflow、CNAME 或站点 owner
- Landing page 引用的 `feature1.png` 至 `feature6.png` 均不存在
- `assets/main.png` 展示 CodeMoss `v0.0.9`，不代表当前产品
- 页面仍使用 Codex-only、macOS/Linux-only 的旧能力叙事
- `assets/app-icon.png` 与根 `icon.png`、Tauri icon 完全重复

历史内容仍可通过 Git history 追溯。不要在本目录恢复 executable HTML；未来若重建官网，应使用独立 site owner、build command、deploy workflow 与 link gate。
