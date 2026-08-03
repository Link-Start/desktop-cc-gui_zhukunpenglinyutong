# Tasks: establish-session-foundation-contracts

## 1. Canonical Fact Schemas（T0.1）

- [x] 1.1 [P0, depends: none] 编写 `schemas/shared-canonical-entry.schema.json`（envelope + 7 类 Shared Fact oneOf 判别 + 共享 definitions）与 `schemas/provider-usage-aggregate.schema.json`；draft-07；用 ajv 编译验证 schema 自身合法。
- [x] 1.2 [P0, depends: 1.1] 编写 valid/invalid 样本（每类 Fact ≥1 valid；缺必填、错误枚举、错误 checksum、错误 schemaVersion 各 ≥1 invalid）与 `schemas/validate.mjs`；运行确认 valid 全过、invalid 全拒。
- [x] 1.3 [P0, depends: 1.2] 编写 `schemas/README.md`：兼容策略（unknown field 透传 / unknown enum fail closed / omit-not-null / integer ms / checksum agility）与校验脚本用法。

## 2. 领域契约（T0.2）

- [x] 2.1 [P0, depends: none] `design.md` 冻结 ExecutionTarget / TurnExecutionSnapshot / SessionOrigin / ConversationFamilyRef / BindingKey / BindingContextCursor / PendingDelivery / BindingProvisioningState。
- [x] 2.2 [P0, depends: none] `design.md` 冻结 NativeHistoryReader / NativeHistoryMaterialization / Legacy fidelity 边界与兼容性策略（§3）。

## 3. Runtime Spikes（T0.3–T0.5，纯调研，无产品代码）

- [x] 3.1 [P0, depends: none, parallel] S1：实测 Codex 0.144.6 `thread/inject_items`（Item 类型 / 持久化 / read-back / duplicate / `clientUserMessageId`），产出 `docs/research/spikes/2026-07-27-s1-codex-thread-inject-items.md` + harness；raw transcript 仅本地留存。
- [x] 3.2 [P0, depends: none, parallel] S2：实测 Claude 2.1.218 `--replay-user-messages`（echo 格式 / checksum 关联 / `result` vs process-exit），产出 `docs/research/spikes/2026-07-27-s2-claude-replay-user-messages.md` + harness；raw transcript 仅本地留存。
- [x] 3.3 [P0, depends: none, parallel] S3：实测 Kimi 0.27.0 ACP（initialize capability / `session/load` replay / prompt lifecycle / Provider 边界），产出 `docs/research/spikes/2026-07-27-s3-kimi-acp.md` + harness；raw transcript 仅本地留存。
- [x] 3.4 [P0, depends: 3.1,3.2,3.3] 三份报告评审：binary identity + sha256 齐全、逐问 PASS/FAIL/PARTIAL、go/no-go 明确；FAIL/PARTIAL 项转写为后续 Wave 的显式降级约束（见 design.md §5.1）。

## 4. Golden Fixtures（T0.6）

- [x] 4.1 [P0, depends: none, parallel] 捕获并脱敏 Claude/Codex native history + live event fixtures，按仓库 fixtures 约定落位（`src-tauri/tests/fixtures/session-foundation/`），附 `manifest.json`。
- [x] 4.2 [P0, depends: 4.1] 新增 loader 测试（`src-tauri/tests/session_foundation_fixtures.rs`）并运行通过：逐行 JSON 可解析、必需字段存在、manifest 与文件一一对应、captured host metadata 不得回归。

## 5. Gate 0 验证

- [x] 5.1 [P0, depends: 1.3,2.2,3.4,4.2] 运行 schema 校验脚本（14/14 PASS）、fixtures loader 测试、`openspec validate establish-session-foundation-contracts --strict --no-interactive`（valid）。
- [x] 5.2 [P0, depends: 5.1] 对照 Gate 0 两条出口条件逐项勾选：三 Spike 实测 matrix 落档（design.md §5.1）；Phase 0 契约 artifacts 齐（proposal/design/specs/schemas/spikes/fixtures）。

## 6. Review Remediation（2026-07-27）

- [x] 6.1 [P0, depends: 3.4] raw transcript / replay evidence 退出仓库，避免提交本机路径、session id、tool/MCP/skill inventory、reasoning 与 auth-source metadata；增加 evidence policy。
- [x] 6.2 [P0, depends: 3.3] ACP harness 默认拒绝 permission，文件访问经 realpath 限制在 cwd 内，并补 request timeout、spawn/exit pending settlement。
- [x] 6.3 [P1, depends: 3.1,3.2] CLI binary 改为 `CODEX_BIN` / `CLAUDE_BIN` 环境变量覆盖 + PATH fallback；schema snapshot checksum 只覆盖实际保留文件。
- [x] 6.4 [P1, depends: 4.2] fixture loader 校验 `captured_at` 与 `entry_type_counts` 总数等于实际行数，并纳入 rustfmt。
