## 1. Source fact parsing

- [x] 1.1 添加 real-shape Codex subagent rollout parser RED test。
- [x] 1.2 解析 parent id 与 agent display label，保持 child canonical UUID/usage。
- [x] 1.3 为 `LocalUsageSessionSummary` 增加 optional relationship field 并更新 explicit constructors。

## 2. Cross-layer projection

- [x] 2.1 workspace/global catalog entry 传递 `parentSessionId`。
- [x] 2.2 native/daemon local-thread fallback 输出 `parentSessionId`。
- [x] 2.3 frontend runtime fallback normalize 为 `ThreadSummary.parentThreadId`。

## 3. Sidebar regression

- [x] 3.1 添加 Codex parent + child tree projection test，锁定一个 root 与独立 child UUID。
- [x] 3.2 确认重复 child rollout 仍按 canonical child identity 收敛。

## 4. Verification

- [x] 4.1 运行 focused Rust/Vitest RED/GREEN evidence。
- [x] 4.2 运行 typecheck、lint、runtime contracts 与 relevant cargo checks。
- [x] 4.3 更新 verification、Trellis executable contract，并完成 strict OpenSpec validation（若环境可用）。

## 5. Review hardening

- [x] 5.1 在 scanner source boundary 按 canonical UUID 去重，避免 duplicate rollout 占用 limit 或重复统计 usage/cost。
- [x] 5.2 catalog 在 dedupe 后计算 `childrenCount`。
- [x] 5.3 local/live merge 将 canonical parent UUID 映射到 visible rollout alias，并补组合回归测试。
- [x] 5.4 匿名化公开 verification 文档中的本地 session identifier。
