# add-caveman-curated-skill-bundle tasks

## 1. Caveman skill 资源（P1）

- [x] 1.1 [P0] 核实上游 `caveman` / `caveman-review` / `caveman-commit` / `caveman-help` 四份 `SKILL.md` 的真实内容（在 `/Users/chenxiangning/code/AI/github/caveman/skills/`），确认聚合范围内覆盖：communication rules + intensity 三档（lite / full / ultra）+ wenyan 三档 + auto-clarity 边界 + `[thing] [action] [reason]. [next step].` 句式 + review 输出格式 + commit 输出格式 + help / capability 描述。
- [x] 1.2 [P0] 明确 runtime-only 边界（`caveman-compress` / `caveman-stats` / `cavecrew` / `caveman-shrink` / `caveman-init`）不属于本次聚合范围，写入 SKILL.md "Runtime-only capabilities (NOT implemented in this client)" 段，禁止虚假声称已执行。
- [x] 1.3 [P0] `src-tauri/resources/curated-skills/caveman/SKILL.md`：单一聚合主 skill，~1400 tokens（远低于 3000 上限），结构：ACTIVE persistence → Response rules → Intensity → Clarity/safety boundaries → Built-in task patterns (review / commit / help) → Runtime-only capabilities → Output shape → When NOT to enable。顶部含 `<!-- Upstream: https://github.com/JuliusBrussee/caveman | License: MIT -->` 注释。
- [x] 1.4 [P0] `src-tauri/resources/curated-skills/caveman/metadata.json`：必填字段 `name=caveman` / `displayName=Caveman` / `version=1.0.0` / `description=Caveman core: concise communication plus safe review and commit guidance, preserving technical substance and exact code or commands.` / `icon=message-circle` / `category=code-style` / `tokenEstimate=1400` / `source=upstream: JuliusBrussee/caveman (core communication rules)` / `sourceUrl=https://github.com/JuliusBrussee/caveman` / `license=MIT`。

## 2. skills-lock.json（P2）

- [x] 2.1 [P0] repo 根 `skills-lock.json` 新增 `caveman` entry：`assetPath=resources/curated-skills/caveman/SKILL.md`、`metadataPath=resources/curated-skills/caveman/metadata.json`、`minClientVersion=0.5.14`、`computedHash=<SKILL.md 字节 SHA-256>`；保留 `lazy-senior-dev` entry 不动。
- [x] 2.2 [P0] 保持 repo 根 `skills-lock.json` 为唯一 lock source；`src-tauri/build.rs` 与 runtime loader 复用它，不创建 `src-tauri/skills-lock.json` 副本。
- [x] 2.3 [P0] 修改 SKILL.md 后 `cargo build` 必须触发 build.rs 重新校验 hash；lock 未同步时 build fail closed，不自动改写 `computedHash`。

## 3. Rust defaults + tests（P3）

- [x] 3.1 [P0] `src-tauri/src/types.rs::default_enabled_curated_skill_ids()` 由 `vec!["lazy-senior-dev"]` 改为 `vec!["lazy-senior-dev", "caveman"]`（位于 `src-tauri/src/types.rs:1766-1768`）。
- [x] 3.2 [P0] `src-tauri/src/types.rs` unit test `app_settings_defaults_enable_core_curated_skills`：分别构造默认 `AppSettings` 与 decode 缺字段 JSON `{}`，断言 `enabled_curated_skill_ids == vec!["lazy-senior-dev", "caveman"]`。
- [x] 3.3 [P0] `src-tauri/src/types.rs` unit test `app_settings_preserves_explicitly_empty_curated_skill_ids`：decode 显式 `{"enabledCuratedSkillIds":[]}`，断言结果仍然为空数组（不被默认填充覆盖，保留用户显式 opt-out）。
- [x] 3.4 [P0] frontend `useAppSettings` 的缺字段 fallback 同步为 `lazy-senior-dev + caveman`，并保留显式空数组 opt-out；focused Vitest 覆盖两种语义。
- [x] 3.5 [P0] 新增 `curatedSkillDefaultsVersion=1` one-shot migration：旧版非空列表补入 Caveman，显式空数组不补，migration 后用户关闭 Caveman 不会在重启时被重新开启。
- [x] 3.6 [P0] `storage::read_settings_migrates_caveman_default_once_and_preserves_opt_out` 覆盖 legacy enable、post-migration disable 与 legacy empty opt-out。

## 3A. Curated description i18n（P3A）

- [x] 3A.1 [P0] Curated row 按 stable skill id 解析 localized description，缺失 translation / 未知 id 回退 `metadata.json.description`。
- [x] 3A.2 [P0] `en/common.ts` 与 `zh/common.ts` 补齐 Caveman / Lazy senior dev descriptions；中文模式显示中文。
- [x] 3A.3 [P0] `categoryLabels.test.ts` 覆盖 localized Caveman description 与 fallback 行为。

## 4. OpenSpec delta（P4）

- [x] 4.1 [P0] `openspec/changes/add-caveman-curated-skill-bundle/specs/curated-skill-bundles/spec.md` 写 delta：
  - `## MODIFIED Requirements` 包含修改 `Requirement: Client MUST Bundle Curated Skills As Versioned Assets`（追加 Caveman 默认 entry 描述 + 新 Scenario `caveman bundled as one aggregated entry`）。
  - 修改 `Requirement: AppSettings MUST Persist Enabled Curated Skill IDs` 的 Purpose 段（默认两条 id）+ Scenario `missing field uses built-in defaults`（替代 `missing field defaults empty`）+ 新 Scenario `explicit empty list remains an opt-out` + 新 Scenario `Caveman is toggled as one family`。
  - `## ADDED Requirements` 新增 `Requirement: Caveman Core MUST Use One Aggregated Control`（单一聚合 body + 安全边界 + runtime-only 不伪造）。
- [x] 4.2 [P0] 主线 `openspec/specs/curated-skill-bundles/spec.md` **不**直接编辑；sync 阶段由 `openspec sync` 把 delta 合并回主线。
- [x] 4.3 [P0] `openspec/changes/README.md` **不**编辑 active table：sync / archive 之后再加入。

## 5. 验证与收尾（P5）

- [x] 5.1 [P0] `cargo check --manifest-path src-tauri/Cargo.toml` → 0 error，无新增 warning（既有 dead-code 与本变更无关）。
- [x] 5.2 [P0] `cargo test --manifest-path src-tauri/Cargo.toml --lib curated_skill` → 44/44 pass，其中包含 `types::tests::app_settings_defaults_enable_core_curated_skills` 与 `app_settings_preserves_explicitly_empty_curated_skill_ids`。
- [x] 5.2a [P0] `npx vitest run src/features/settings/hooks/useAppSettings.test.ts` → 29/29 pass，覆盖缺字段的双默认值与显式空数组 opt-out。
- [x] 5.3 [P0] `openspec validate add-caveman-curated-skill-bundle --strict --no-interactive` → valid。
- [x] 5.4 [P0] `git diff --check` → 无 whitespace / conflict marker 警告。
- [x] 5.5 [P1] `python3 ./.trellis/scripts/get_context.py --mode record` 在 commit 前取 developer id。
- [x] 5.6 [P1] runtime contract scripts：`check-engine-capability-matrix.mjs` / `check-app-shell-runtime-contract.mjs` / `check-git-history-runtime-contract.mjs` / `check-refactor-imports.mjs` / `doctor:strict` 全绿（curated skill 不在它们 contract 覆盖范围，预计本变更不影响）。

## 6. 文档同步（P6）

- [x] 6.1 [P0] `openspec/changes/add-caveman-curated-skill-bundle/{proposal,tasks,design}.md` 同步反映实际实现 + 用户审查后任何修改。
- [x] 6.2 [P0] `openspec/changes/add-caveman-curated-skill-bundle/specs/curated-skill-bundles/spec.md` delta 与 proposal / design 一致。
- [x] 6.3 [P1] git commit（中文主体 Conventional Commit：`feat(curated-skills): 内置 Caveman 主体 curated skill`） + Trellis session record（用户已授权收口）。
- [x] 6.4 [P1] 验证完成后按 release strategy 执行 OpenSpec sync / archive，并刷新对应 active / archive index。

## 7. Codex current-thread deactivation（P7）

- [x] 7.1 [P0] `codex_curated_skills_developer_instructions_block()` 输出 authoritative snapshot；部分关闭时未列出的旧 bundled skill 失效，全部关闭时显式输出 `Enabled: none`。
- [x] 7.2 [P0] macOS / Linux spawn 与全平台 turn-start 复用同一个 snapshot builder；Windows 保持 turn-only transport，不 fork 新 thread，不覆盖 user-supplied / system instructions 或其他 skill mechanism。
- [x] 7.3 [P0] Rust regression tests 覆盖 enabled snapshot、partial snapshot 与 empty deactivation snapshot，并断言 empty snapshot 不含任何 `<skill>` body。
- [x] 7.4 [P0] 修复 re-enable regression：desktop、shared session、daemon 在 macOS / Linux / Windows 的 next `turn/start` 都读取最新 settings snapshot；保留 macOS / Linux 原 spawn 注入和 Windows argv omit 边界。
