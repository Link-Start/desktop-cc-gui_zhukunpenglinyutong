## 1. Terminal durable settlement

- [x] 1.1 P0：输入 Shared assistant delta/item identity 与 `turn/completed.result.text`，输出同一 item 的单次完整 completion；以 focused event-hook test 验证（无依赖）
- [x] 1.2 P0：输入完整 completion 后的 reducer items，输出可被 Shared snapshot effect 持久化的完整 final；以 existing item-event/reducer focused tests 验证（依赖 1.1）

## 2. History completeness guard

- [x] 2.1 P0：输入同 Turn 的 Legacy 长正文与 canonical 短前缀，输出长正文 + canonical target metadata；以 assembler/loader focused tests 验证（无依赖）
- [x] 2.2 P1：输入 Legacy 短前缀与 canonical 长正文、以及无关正文，分别验证升级与不误合并（依赖 2.1）

## 3. Existing data recovery

- [x] 3.1 P0：备份受影响 Shared `log.jsonl`，从绑定 Native transcript 校验两个截断 Turn 的完整 final，追加 corrected snapshot（依赖 1.1、2.1）
- [x] 3.2 P0：验证最新 Shared snapshot 中不再存在“我是”/`Cl` 截断 final，备份可回滚（依赖 3.1）

## 4. Foundation regression gates

- [x] 4.1 P0：运行受影响 Vitest、typecheck、局部 ESLint、`git diff --check`，不运行全量测试（依赖 1–3）
- [x] 4.2 P1：执行 break-loop，更新 streaming/cross-layer spec，记录 terminal durability invariant（依赖 4.1）
- [x] 4.3 P1：OpenSpec strict validate、sync/archive，并归档 Trellis task（依赖 4.2）
