## 1. Shared Context Integrity（P0，依赖：无）

- [x] 1.1 修正 Context Package identity；输入为 compiler/destination/capabilities/budget/source，输出为 deterministic 且不冲突的 package id；以 Rust tests 验证
- [x] 1.2 修正 package payload checksum 与读取复核；输入为 artifact record，输出为 tamper-evident retrieval；以篡改回归测试验证
- [x] 1.3 修正 macOS/Windows/Linux 并发原子发布与 temp cleanup；以 concurrent writer test 验证

## 2. Native History Boundary（P0，依赖：1）

- [x] 2.1 增加 Native History byte limit 与 `source-too-large` typed error；以 sparse oversized fixture 验证
- [x] 2.2 allowlist portable blocks 并记录 private/unknown omissions；以 Claude/Codex/Kimi fixture tests 验证
- [x] 2.3 将 prepare/recovery 的 blocking native file 工作移出 async runtime 热路径；以 focused Rust tests 与 code review 验证

## 3. Capability And Interaction（P0，依赖：1、2）

- [x] 3.1 增加无副作用 Codex `thread/inject_items` method probe，并删除 Engine/前端常量猜测；以 response classification tests 验证
- [x] 3.2 用现有 Tauri Dialog 替换 degraded flow 的 `window.confirm`；以 Vitest confirm/cancel tests 验证

## 4. Closure（P1，依赖：1、2、3）

- [x] 4.1 运行 focused Rust integration/unit tests、Sidebar Vitest、typecheck 与格式检查
- [x] 4.2 更新总任务清单、影响报告与 OpenSpec 主 specs，记录 review findings 和验收证据
- [x] 4.3 执行 cross-layer/finish-work review、OpenSpec strict verify/sync/archive、提交并记录 Trellis session
