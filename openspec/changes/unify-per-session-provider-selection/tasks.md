# Tasks — unify-per-session-provider-selection

> 执行策略：按 batch 独立实现、增量测试、review、commit。禁止用全量测试替代定向验证。

## 0. Artifact calibration

- [x] 0.1 核对现有 session identity、thread `providerProfile*`、catalog overlay、runtime owner 与三引擎 provider CRUD，确认不新建平行基础设施
- [x] 0.2 更新 proposal/design/spec/tasks，并通过 `openspec validate unify-per-session-provider-selection --strict`

## 1. Batch A — durable binding 与 request contract

- [x] 1.1 将 binding value 泛化为 `EngineProviderBinding`，保留 `CodexProviderBinding` compatibility alias；catalog 新增 `serde(default)` 的 canonical unified binding map
- [x] 1.2 实现显式 `engine + workspace owner + canonical/logical session identity` 的 binding key/read/idempotent write；禁止从无前缀 native id 猜 engine
- [x] 1.3 catalog overlay 支持 Claude/Codex/Kimi，保留 legacy Codex map read compatibility；补 pending/canonical、restart、unprefixed Kimi id 定向测试
- [x] 1.4 frontend service、desktop command、remote JSON、daemon router/state 对称增加 optional `providerProfileId`；补 request mapping contract test
- [x] 1.5 实现 effective binding 解析顺序：request profile > durable managed binding > default（provider 存在性分别由 Batch B/C engine resolver 校验）
- [x] 1.6 运行 catalog/request targeted Rust tests、runtime-contract gate、`git diff --check`；独立 review 后提交

## 2. Batch B — Claude per-turn provider env

- [x] 2.1 从既有 Claude vendor config 暴露窄 provider env resolver：local/None 无 override，managed 返回完整 env，missing provider 显式失败
- [x] 2.2 为 Claude send/build command 增加 engine-specific provider env launch context；保持 `SendMessageParams` 与旧调用入口兼容
- [x] 2.3 `engine_send_message` Claude 分支消费 effective binding、持久化 managed binding，并在每个 turn 注入 env
- [x] 2.4 补 local/default、managed env、env override、missing provider、双 provider 并行定向测试
- [x] 2.5 运行 Claude targeted Rust tests、`git diff --check`；独立 review 后提交

## 3. Batch C — Kimi provider home 与 runtime ownership

- [x] 3.1 在 app paths 增加 `~/.ccgui/kimi-provider-homes` 路径
- [x] 3.2 将既有 Kimi TOML builder/write-at-path 提炼为可复用 helper；保持 `providers/models/default_model` 一致、路径安全与 0600
- [x] 3.3 实现 Kimi profile resolver/materializer：local/None 使用 global home，managed 使用独立 home，missing provider 显式失败
- [x] 3.4 Kimi manager key 纳入 provider；workspace interrupt、turn interrupt、list、remove、shutdown 查找全部 matching runtime
- [x] 3.5 cleanup 失败显式传播并保留 process owner；`engine_send_message` Kimi 分支消费 effective binding并持久化 managed binding
- [x] 3.6 补 materialization、path traversal、permission、`KIMI_CODE_HOME`、双 provider、workspace cleanup 定向测试
- [x] 3.7 运行 Kimi targeted Rust tests、`git diff --check`；独立 review 后提交

## 4. Batch D — frontend provider selection

- [ ] 4.1 泛化 `EngineProviderProfileOption` 与三引擎 local/default constants/storage keys，保留 Codex type alias
- [ ] 4.2 `Sidebar` 加载 Claude/Codex/Kimi provider profiles，复用 normalization、取消保护、错误 fallback，避免 root 高频刷新
- [ ] 4.3 `useSidebarMenus` 为 Claude/Kimi 增加 provider submenu、selection memory、提示与中英文文案；local/default 明示跟随全局
- [ ] 4.4 Claude/Kimi 乐观 `ensureThread` 写入现有 `selectedProviderBinding`
- [ ] 4.5 补 provider loading/menu/local-default/optimistic thread 定向 Vitest
- [ ] 4.6 运行受影响 Vitest、TypeScript typecheck、`git diff --check`；独立 review 后提交

## 5. Batch E — send、identity convergence、fork 与 label

- [ ] 5.1 `engineSendMessage` 与 messaging hook 每次从当前 thread state 透传 `providerProfileId`，不读取菜单当前值
- [ ] 5.2 pending → canonical replacement、catalog hydration 与 restart recovery 保留 `providerProfile*`
- [ ] 5.3 Claude fork / Kimi continue child thread 继承父 thread binding
- [ ] 5.4 provider label projection 泛化到 Claude/Codex/Kimi；local/default 不显示为 managed isolation
- [ ] 5.5 补 send、rename/hydration、fork/continue、label 定向 Vitest
- [ ] 5.6 运行受影响 Vitest、TypeScript typecheck、runtime-contract gate、`git diff --check`；独立 review 后提交

## 6. Close-loop verification

- [ ] 6.1 执行全部新增/受影响 targeted Rust tests 与 Vitest（仍不运行全量测试）
- [ ] 6.2 执行 TypeScript typecheck、runtime-contract gate、change strict validation 与 diff hygiene
- [ ] 6.3 独立 review desktop/daemon parity、provider deletion error、Kimi ownership cleanup、render hard lines
- [ ] 6.4 记录实现证据与人工验收清单，执行 OpenSpec verify
- [ ] 6.5 sync delta specs、archive change，并验证 archive 后规范可见性
