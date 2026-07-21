# Harden messages module boundaries

## OpenSpec

- Change: `openspec/changes/harden-messages-module-boundaries`
- Roadmap: `docs/superpowers/plans/2026-07-21-messages-high-cohesion-low-coupling-roadmap.md` Phase 0

## 目标

- 归档已完成的第一阶段 messages presentation change 并同步 main spec。
- 记录当前 inbound/outbound dependency inventory 与质量基线。
- 建立 exact allowlist static gate，阻止新增 messages private import debt。

## 验收

- boundary gate positive/negative fixture 均有证据。
- OpenSpec strict validation、checker syntax/lint、`git diff --check` 通过。
- baseline large-file gate 的既有失败明确记录，不归因于本 change。
