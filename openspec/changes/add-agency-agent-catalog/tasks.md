## 1. Catalog 资产与生成器

- [x] 1.1 [P0, deps: none] 新增 Agency Agents snapshot generator；输入固定 revision checkout 与 repo-owned `zh-CN` overrides，输出 deterministic `manifest.json`、`agents.json`、`prompts/*.md`、`LICENSE`；运行 generator self-check 验证 safe path、stable order 与 schema。
- [x] 1.2 [P0, deps: 1.1] 补齐 248 个 Agent 的中文名称/描述和 17 个 division 中文 label；输出 packaged metadata；运行 coverage check 验证 divisions=17、agents=248、missing locale=0、duplicate id=0。
- [x] 1.3 [P0, deps: 1.1] 将 `src-tauri/resources/agent-catalogs` 纳入 Tauri bundle 与 build-time integrity validation；输出可在 dev/release layout 解析的 resources；运行 `cargo check`/focused Rust tests 验证 hash 与 package path。

## 2. Backend Catalog 与 Enable Registry

- [x] 2.1 [P0, deps: 1.3] 新增 `agent_catalog` loader 与 metadata/body 分离读取；输入 bundled package；输出 normalized divisions/agents 与单项 Prompt resolver；Rust tests 覆盖 unsafe path、unknown ID、empty body、hash mismatch。
- [x] 2.2 [P0, deps: 2.1] 扩展 `AppSettings.enabled_builtin_agent_ids` 及 frontend mapping；输入旧/新 settings JSON；输出 default-empty、trim/dedupe/stable normalization；storage/settings tests 验证向后兼容。
- [x] 2.3 [P0, deps: 2.1, 2.2] 注册 list/toggle/division-toggle/resolve Tauri commands 并保持 daemon/Desktop parity；输入 locale、Agent ID、division ID；输出 metadata、updated settings 或 Prompt provenance；command tests 验证 unknown reject 与 disabled resolve fail-closed。
- [x] 2.4 [P1, deps: 2.2] 将 Agent name validation 从 20 扩展到 64；输入 CRUD/import payload；输出一致 frontend/backend validation；现有 agents tests 与新增边界 tests 通过。

## 3. Settings 分组管理

- [x] 3.1 [P0, deps: 2.3] 新增 frontend Catalog types、Tauri adapters 与 feature-local hook；输入 backend payload/AppSettings；输出 localized division/Agent view model、search/filter/count/toggle handlers；pure helper/hook tests 通过。
- [x] 3.2 [P0, deps: 3.1] 在 Agent Settings 中增加“我的智能体 / 内置智能体”二级视图；输出全部/17 divisions、enabled/total、搜索、全部/仅开启、单项 Switch、division 批量开关；component tests 覆盖 keyboard/accessibility 与状态更新。
- [x] 3.3 [P1, deps: 2.3, 3.2] 增加详情与“复制到我的智能体”；输入单项 metadata/body；输出 user-owned Agent draft/save；测试验证复制后独立于 bundled enable 状态且原 CRUD 不回退。

## 4. Composer `#` 与运行时激活

- [x] 4.1 [P0, deps: 2.3, 3.1] 扩展 `agentProvider` 合并 custom 与 enabled built-in metadata；输出按“我的智能体 / division”分组的 `#` 结果；provider tests 验证 disabled 项在空态和搜索中均不可见。
- [x] 4.2 [P0, deps: 4.1] 扩展 selected Agent contract 保存 source/provenance 且 built-in selection 不持久化 Prompt body；输入 `#` selection；输出可见 Agent Chip 与 thread-scoped selection；session tests 验证 custom backward compatibility。
- [x] 4.3 [P0, deps: 2.3, 4.2] 在 send path 为 built-in Agent 增加 backend resolve 与 enable/hash 二次校验；输出复用现有 Agent Prompt block；tests 验证 enabled-but-unselected 不注入、selected 注入、disabled/missing/hash error 不注入旧 Prompt。
- [x] 4.4 [P1, deps: 3.2, 4.1, 4.2] Settings toggle 后以事件驱动刷新 provider/selection；输出无需重启的 discoverability 变化与 stale Chip 清理；interaction tests 验证无秒级 polling。

## 5. i18n、质量门禁与交付

- [x] 5.1 [P0, deps: 3.2, 4.1] 为 10 个现有 locale 补齐 UI keys，并实现 Catalog `zh/zh-TW/en` fallback；输出无硬编码用户文案的界面；i18n chunk/check tests 通过。
- [x] 5.2 [P0, deps: 1-5 implementation] 运行 Catalog integrity check、focused Vitest、`npm run typecheck`、Rust focused tests、`cargo test --manifest-path src-tauri/Cargo.toml`；修复所有本变更引入的失败并记录结果。
- [x] 5.3 [P0, deps: 5.2] 执行 `openspec validate --all --strict --no-interactive`、cross-layer/reuse 检查与 `git diff --check`；更新 tasks 勾选和 verification evidence；保留工作区改动且不执行 Git commit。
- [x] 5.4 [P1, deps: 5.3] 闭环用户验收 Review：将 Catalog `sourceUrl` 渲染为可访问 upstream link，精修 `#` non-selectable 分组标题并展示可见数量，增加 Catalog hook/provider request generation guard 与回归测试，修正 send 前错误提示时态；保持不提交。
