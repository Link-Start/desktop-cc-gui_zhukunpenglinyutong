## 1. Native History Source Contract

- [ ] 1.1 [P0, depends: none] 定义 NativeHistorySource/Capability/ReadResult/typed error；输入为 engine/provider/native identity，输出为 stable cursor、fingerprint、canonical-shaped entries；用 Rust serialization tests 验证。
- [ ] 1.2 [P0, depends: 1.1] 实现 Claude JSONL Reader；只读 probe/read 到 frozen byte boundary，输出 provenance/fidelity/omissions；用 append/drift/corrupt fixtures 验证。
- [ ] 1.3 [P0, depends: 1.1] 实现 Codex rollout Reader；复用 provider-scoped CODEX_HOME/path resolver，禁止复制 vendor file；用 Tool pair 与 stable cursor fixtures 验证。
- [ ] 1.4 [P0, depends: 1.1] 实现 Kimi public history Reader；能力不可证明时 typed unsupported；用 state/wire fixtures 验证。

## 2. Native Context Materialization

- [ ] 2.1 [P0, depends: 1.1] 扩展 ContextPackage native-history source identity 与 native entry compile；输出 deterministic package/checksum；用相同/不同 fingerprint tests 验证。
- [ ] 2.2 [P0, depends: 2.1] 泛化 Artifact Store typed payload 写入/读取，同时保持旧 ContextPackage API；用 ownership/checksum/atomic write tests 验证。
- [ ] 2.3 [P0, depends: 1.2,1.3,1.4,2.2] 实现 SQLite continuation operation/materialization store；输入 operation snapshot，输出 immutable refs/phase/result identity；用 conflict/retry/integrity tests 验证。

## 3. Continuation Backend Flow

- [ ] 3.1 [P0, depends: 2.3] 实现 prepare command：resolve source→probe/read→compile→artifacts→durable commit；验证 target side effect 前已 prepared，unstable cursor 不落盘。
- [ ] 3.2 [P0, depends: 3.1] 实现目标 adapter execute/recovery：Codex inject、Claude echo ACK、Kimi capability gate；验证 ACK ambiguous 不盲建。
- [ ] 3.3 [P0, depends: 3.2] 持久化 target Provider Binding、SessionOrigin 与 ConversationFamilyRef；验证无 parentThreadId、来源不变、删除来源不级联。
- [ ] 3.4 [P0, depends: 3.3] 注册 Tauri 与 daemon 同构 command/payload；用 command mapping 与 remote parity tests 验证。
- [ ] 3.5 [P0, depends: 3.4] 校准 Codex 不同 Provider fork：移除 vendor rollout copy/native-provider-rebind，路由到 Continuation；保留同 Provider native fork tests。

## 4. Frontend Flow And Projection

- [ ] 4.1 [P1, depends: 3.4] 扩展 ThreadSummary/service mapping 与 Continuation DTO/actions；用 strict TypeScript 与 payload tests 验证。
- [ ] 4.2 [P1, depends: 4.1] 增加“使用其他 Provider 继续”菜单、Provider 选择、重复点击 guard 与 degraded confirmation；用 component/hook tests 验证。
- [ ] 4.3 [P1, depends: 4.1] 增加“供应商续接”顶层标签和“查看来源会话”导航；验证不显示子代理、不嵌套、来源缺失可解释。

## 5. Review And Closure

- [ ] 5.1 [P0, depends: 1-4] 执行 cross-layer review，检查 source→reader→materialization→target→catalog→UI 数据流与同层遗漏；修复 findings。
- [ ] 5.2 [P0, depends: 5.1] 只运行 Change D 增量 Rust/Vitest/typecheck/lint/OpenSpec strict validation；记录结果，不跑全量代码测试。
- [ ] 5.3 [P1, depends: 5.2] 记录 Desktop smoke matrix：Claude Provider A→Codex Provider B→原 Provider、degraded confirmation、历史连续性、recovery；自动化覆盖可确定部分，人工观察项保留发布前 gate。
- [ ] 5.4 [P0, depends: 5.3] 更新 Trellis executable contract、总任务清单与 verification；sync/archive OpenSpec 并提交，随后执行 Trellis session record。
