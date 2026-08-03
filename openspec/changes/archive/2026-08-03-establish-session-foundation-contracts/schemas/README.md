# Canonical Fact Schemas（Wave 0 / T0.1）

本目录是多 CLI × 多 Provider 会话基石的字段级契约，语义说明见同 change 的 `design.md` 与 `specs/session-foundation-contracts/spec.md`。

## 文件

| 文件 | 内容 |
|---|---|
| `shared-canonical-entry.schema.json` | Shared Event Log envelope（`schemaVersion: 2`）+ 7 类 Shared Fact 的 oneOf 判别 |
| `provider-usage-aggregate.schema.json` | Provider Usage Ledger entry（`schemaVersion: 1`），独立于 envelope，无 `logicalSessionId` |
| `validate.mjs` | 校验脚本：编译 schema + valid 全过 / invalid 全拒 |
| `examples/valid/`、`examples/invalid/` | 正/反例样本，同时是后续 Wave 的 golden 输入 |

运行（仓库根目录）：

```bash
node openspec/changes/establish-session-foundation-contracts/schemas/validate.mjs
```

## 兼容策略（所有读者必须遵守）

| 情形 | 规则 |
|---|---|
| `schemaVersion` 不匹配 | fail closed，typed error；禁止 coerce 或部分解释 |
| 未知字段 | 允许存在；reader 忽略；read-modify-write 必须原样保留（schema 以 `additionalProperties: true` 表达） |
| 未知枚举值（`factType` / `mode` / `outcome.status` / `fidelity` 等封闭枚举） | fail closed，typed error；禁止映射为默认值继续 |
| 未知 checksum algorithm（非 `sha256:` 前缀） | fail closed；algorithm prefix 是唯一的升级通道 |
| 可选字段缺省 | 省略字段本身，禁止写 `null` |
| 时间戳 | integer ms（epoch UTC）；浮点/字符串一律拒绝 |
| ID 类字段 | opaque non-empty string，不假设格式 |
| `sequence` / `revision` | 非负 integer，per-owner 单调；允许空洞，不回退 |

演进原则：只加可选字段，不改既有字段语义，不复用字段名表达新含义；breaking 变化 bump `schemaVersion` 并提供双读窗口。

## 实现备注

- draft-07 选型理由：ajv 6/8、python `jsonschema`、Rust `jsonschema` crate 均支持，Wave 1 的 Rust payload 校验可直接消费同一文件。
- `EngineType` 枚举与 `src/types/engine.ts` 对齐（`claude/codex/gemini/kimi/opencode`）；Shared V2 的实际支持范围由 runtime capability probe 决定，不由 schema 限制。
- `assistantBlock.kind` 是封闭枚举（`text/reasoning/redacted-reasoning/artifact-ref`）：新增 block 类型需要 schema 演进，不能悄悄塞新值。
- `conversation.usageRecorded` 在存储层走 `dedupe_key = usageRecordId` 的例外路径（不参与 `attemptId + factType` 唯一约束），见 design.md §4 与 Foundation Design §14.4.2。
- 校验脚本只依赖仓库 `node_modules` 已有的 ajv；解析失败会明确报错退出，不静默跳过。
