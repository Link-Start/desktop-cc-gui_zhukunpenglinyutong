# add-caveman-curated-skill-bundle

## Why

当前 ccgui 客户端只把 `lazy-senior-dev`（Ponytail `AGENTS.md`）作为默认开启的 bundled curated skill。Ponytail 上游另外还存在一份姊妹项目 [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)，它把"少写文字但保留准确信息"作为另一条独立的 output policy，与 Ponytail 的"少写代码"互补——一个管 prose，一个管 code。两条 policy 没有冲突，可以叠加生效。

仓库已经有完整机制把一份 `curated-skills/<id>/{SKILL.md, metadata.json}` 资源 + `skills-lock.json` 条目打包进 desktop client，并由 `enabledCuratedSkillIds` 注入到 Codex / Claude launch 的 developer instructions / activation hint。Caveman 需要的运行时能力**只有 prompt injection**，不依赖新的 Tauri command、不依赖 MCP、不依赖 subagent runtime——这跟现有 Ponytail `lazy-senior-dev` 的 bundled 模式同构，所以可以沿用同样的接入路径。

如果不在客户端内置 Caveman，用户只能靠把 `SKILL.md` 放进 `~/.claude/skills/` 这种外部路径来启用它，破坏"client 版本与 skill 版本 pin 住"的核心契约。

## 目标与边界

- 在客户端内置一条新的 bundled curated skill `caveman`：
  - 资源路径 `src-tauri/resources/curated-skills/caveman/{SKILL.md, metadata.json}`
  - `skills-lock.json` 注册 `caveman` lock entry，SHA-256 与 `SKILL.md` 字节对齐
  - `metadata.json` 字段齐备（name / displayName / version / description / icon / category / tokenEstimate / source / sourceUrl / license）
  - `SKILL.md` 顶部声明 `<!-- Upstream: ... | License: ... -->` 注释，符合 build-time 校验
- 把 `caveman` 加入 `default_enabled_curated_skill_ids()`，与 `lazy-senior-dev` 并列默认开启；旧版非空 curated 配置通过 versioned one-shot migration 自动补入 Caveman，迁移后用户主动关闭必须保持关闭。
- Settings UI `Curated` 区只有 `Ponytail: lazy senior dev` 与 `Caveman` 两个开关；Caveman 是单一聚合控制，不拆 `caveman-review` / `caveman-commit` / `caveman-help` 三个开关。
- aggregated body 覆盖上游 `caveman` 的核心沟通规则、intensity 三档（lite / full / ultra）、wenyan 三档（wenyan-lite / wenyan-full / wenyan-ultra）、auto-clarity 边界、`[thing] [action] [reason]. [next step].` 句式，以及 `caveman-review` 的 review 输出格式、`caveman-commit` 的 commit message 格式、`caveman-help` 的 help/capability 边界。
- aggregated body 明确标注 `caveman-compress` / `caveman-stats` / `cavecrew` / `caveman-shrink` / `caveman-init` 属于 runtime-only 能力，当前客户端未实现，禁止虚假声称已执行。
- 安全边界：保留 code / commands / URLs / paths / identifiers / 错误字符串原样；禁止 invented prose abbreviation（`cfg/impl/req/res/fn` 等）与 `→` 箭头；security / irreversible / ambiguous / multi-step / 用户困惑 五类场景必须用完整表达，不走压缩。
- commit message skill 只生成"ready to use"的 commit message 文本，**不**实际执行 `git commit`——保持现有 `lazy-senior-dev` 的边界（用户主动触发提交动作）。
- Codex curated injection 必须携带 authoritative snapshot：只有当前 snapshot 中列出的 ccgui bundled curated skill 才生效。关闭部分或全部 skill 后，即使继续 resume 同一 Codex thread，旧轮次中已出现但不在最新 snapshot 中的 bundled skill 也必须明确失效；该规则不得覆盖用户自定义 `developer_instructions`、系统规则或按需调用的其他 skill。

## 非目标

- 不实现 `caveman-compress`（session log / context file 压缩）：需要 hooks 或外部脚本，runtime-only。
- 不实现 `caveman-stats`（token statistics / logging）：需要额外 telemetry / 持久化。
- 不实现 `cavecrew`（Caveman-aware subagent 编排）：需要 subagent runtime API。
- 不实现 `caveman-shrink`（MCP description 缩短）：需要 MCP middleware。
- 不实现 `caveman-init`（repo-wide `.caveman*` rule 安装）：需要写工作区之外的 dotfile。
- 不新增 Tauri command、不改 Codex / Claude launch path、不动 build.rs 的 lock validator 字段规则（hash / license / icon / category / tokenEstimate / id 格式都已经在 Ponytail 路径上验证通过，复用即可）。
- 不提供 Ponytail / Caveman 之间的"二选一"强制策略；两条 skill 并存，用户可在 Settings 各自开关。
- 不在 Composer 提供 per-message toggle；继续遵守现有"Composer 只读反馈、Settings 是唯一 toggle 表面"约束。
- 不改 `caveman-stats` / `cavecrew` 之类 runtime 子命令的 shell wrapper（客户端不存在 shell entry point）。
- 不为 caveman skill 自动下载 upstream 新版本；版本跟随 client release 升级，由 build-time `skills-lock.json` pin 住。

## What Changes

### Spec deltas

- `openspec/specs/curated-skill-bundles/spec.md`：
  - `## MODIFIED Requirements` 下：
    - 修改 `Requirement: Client MUST Bundle Curated Skills As Versioned Assets` 的 Purpose 段，说明"当前客户端默认两条 curated entries"
    - 在该 Requirement 下追加 `Scenario: caveman bundled as one aggregated entry`
    - 修改 `Requirement: AppSettings MUST Persist Enabled Curated Skill IDs` 的 Purpose 段，把默认值从"empty array"改成"lazy-senior-dev + caveman"
    - 修改 `Scenario: missing field defaults empty` 名称为 `Scenario: missing field uses built-in defaults`，默认两条 id
    - 追加 `Scenario: explicit empty list remains an opt-out`（空数组仍是显式 opt-out）
    - 追加 `Scenario: Caveman is toggled as one family`（Caveman 单开关控制整个 family）
  - `## ADDED Requirements` 下：
    - 新增 `Requirement: Caveman Core MUST Use One Aggregated Control`，聚合 body 覆盖 communication rules / review / commit / help，明确 runtime-only capability 不可声称、safety boundary 必须还原完整表达。

### Rust / 资源

- `src-tauri/resources/curated-skills/caveman/SKILL.md`：单一聚合主 skill（~1400 tokens，远低于 3000 上限），结构：ACTIVE persistence + Response rules + Intensity 三档 + Clarity/safety boundaries + Built-in task patterns (review / commit / help) + Runtime boundary + Output shape + When NOT to enable。
- `src-tauri/resources/curated-skills/caveman/metadata.json`：必填字段齐备，`tokenEstimate: 1400`，`license: MIT`，`sourceUrl: https://github.com/JuliusBrussee/caveman`。
- repo 根 `skills-lock.json`：新增 `caveman` entry，`computedHash` 是当前 `SKILL.md` 的真实 SHA-256；Ponytail entry hash 保持不变。`src-tauri/build.rs` 与 runtime loader 都复用这一份 lock single source。
- `src-tauri/src/types.rs::default_enabled_curated_skill_ids()`：从 `vec!["lazy-senior-dev"]` 改成 `vec!["lazy-senior-dev", "caveman"]`。
- `AppSettings.curated_skill_defaults_version` + `storage::read_settings()`：对旧版非空 curated 配置执行一次 Caveman default migration；显式空数组仍保持全量 opt-out，版本升级后不再自动补回。
- `src-tauri/src/types.rs` 的 unit tests `app_settings_defaults_enable_core_curated_skills` 与 `app_settings_preserves_explicitly_empty_curated_skill_ids`：前者断言两条默认 id 都在，后者断言显式空数组仍然为空；无需新增 test 文件。

### Frontend settings fallback

- `src/features/settings/hooks/useAppSettings.ts` 的 frontend default 同步为 `lazy-senior-dev + caveman`，确保 remote / older backend payload 缺少 `enabledCuratedSkillIds` 时不会退回旧的单 skill 默认值。
- `src/features/settings/hooks/useAppSettings.test.ts` 覆盖缺字段使用两条 built-in defaults，并继续覆盖显式 `[]` 不被默认值覆盖。
- Curated row description 按 skill id 解析 i18n key；简体中文下 Caveman 与 Ponytail 描述显示中文，英文与其他 fallback locale 保持现有 fallback chain。

### Build / runtime 行为

- `tauri.conf.json` 的 `bundle.resources` 映射保持 `resources/curated-skills` → `curated-skills` 目录映射（已在 Ponytail 路径上验证）；build.rs 在 lock hash / license / icon / category / tokenEstimate / id 格式校验通过后自动重 build。
- Codex macOS / Linux launch：`developer_instructions` 内 `<skill id="caveman">` 块自动包含（与 `lazy-senior-dev` 并列）。
- Codex Windows launch：通过 turn-start `collaborationMode.settings.developer_instructions` 携带 `<skill id="caveman">`；argv 不带 `--profile ccgui-generated-instructions`。
- Codex macOS / Linux spawn 与 Windows turn-start 使用同一 authoritative curated snapshot 文案；空列表也必须发送 `Enabled: none` deactivation state，不能通过省略 block 表示关闭，因为 app-server restart 后仍可能 resume 包含旧指令的 thread history。
- Claude Windows launch：`--append-system-prompt-file` 指向的 activation hint 内含 `caveman` id，提示 Claude 调 `Skill(skill="caveman")`；Claude macOS / Linux 走现有 `--append-system-prompt` 路径。

## 方案对比与取舍

### 方案 A：单一聚合 `caveman` entry（采用）

- 把 upstream `caveman` / `caveman-review` / `caveman-commit` / `caveman-help` 四份 SKILL.md 内容合并到一份 `caveman/SKILL.md`。
- Settings 只暴露 `Caveman` 一个开关。
- 优点：与 Ponytail `lazy-senior-dev`（一份 AGENTS.md 覆盖所有模式）的 product model 对齐；用户认知负担最小；build.rs / skills-lock / default enabled / Settings UI 全部沿用一条流水线；`tokenEstimate` 单值易估算。
- 缺点：用户在 review / commit / help 三种 task pattern 之间无法单独屏蔽——但 Ponytail 的"lazy"哲学本来就不鼓励"按 task 拆开关"，与 Caveman 的"一以贯之"哲学契合。

### 方案 B：拆成 `caveman` / `caveman-review` / `caveman-commit` / `caveman-help` 四个 entry（弃）

- 优点：粒度细，用户可单独关 review 而保留 commit。
- 缺点：与 Ponytail `lazy-senior-dev` 单开关 product model 不对称；Settings 多 3 个开关；`enabled_curated_skill_ids` 列表平均长度翻倍；用户初次接触客户端要理解 4 个 Caveman 相关开关与 1 个 Ponytail 开关的语义差异；build-time lock hash 与 token budget 需要重新对齐。

### 方案 C：把 upstream `caveman` 全部子能力（含 compress / stats / cavecrew / shrink / init）一并 runtime 实现（弃）

- 优点：理论上完整复刻 upstream。
- 缺点：超出本变更范围（每个子能力都是独立 OpenSpec change，需要 hooks / subagent / MCP / shell wrapper）；CCGUI 当前没有这些 runtime 接入点；`cavecrew` 等依赖 multi-agent 编排，与现有 `curated-skill-bundles` capability 的"prompt-only 注入"模型不兼容；工作量是方案 A 的 5-10 倍。
- 退路：上游 runtime-only capability 在 SKILL.md 内显式标注 "client 当前不实现"，给后续 change 留 hook。

## 验收标准

- `cargo check --manifest-path src-tauri/Cargo.toml` 0 error。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib curated_skill` 与两条 `types::tests::app_settings_*curated_skill*` default / explicit opt-out 校验全绿。
- `openspec validate add-caveman-curated-skill-bundle --strict --no-interactive` 通过。
- `npm run tauri dev` 启动 Settings → MCP / Skills → `Curated` 区只有 2 个 toggle：`Ponytail: lazy senior dev` 与 `Caveman`；两者默认勾选；关闭 Caveman 后 `enabledCuratedSkillIds` 仅剩 `["lazy-senior-dev"]`，重新打开恢复成 `["lazy-senior-dev", "caveman"]`。
- 从只持久化 `["lazy-senior-dev"]` 的旧版 settings 首次升级时 Caveman 自动开启；用户随后关闭并重启后保持关闭；旧版显式 `[]` 不自动开启任何 curated skill。
- 简体中文界面中 Caveman 描述显示中文；English locale 保持英文，未知 skill 或缺失 translation 时回退到 metadata description。
- Codex macOS 启动后 `developer_instructions` 同时含 `<skill id="lazy-senior-dev">` 与 `<skill id="caveman">` 块；用户对谈时观察 prose 同时受 Caveman（短句、保留 code）+ Ponytail（最小改动、复用既有 helper）两条规则约束。
- 在同一 Codex thread 中先启用两条 bundled curated skill，再关闭 Caveman 或关闭全部；下一 turn 的 authoritative snapshot 必须只列出仍启用的 id，或明确 `Enabled: none`，并声明旧轮次中未列出的 ccgui bundled curated instructions 已失效。不得要求创建新 thread 才能停用。
- 触发 `caveman-commit` task pattern（直接对话："帮我写个 commit message"）时输出 `type(scope): 中文动宾短句` 模板 + ready-to-use message，**不**自动执行 `git commit`。
- 触发 `caveman-review` task pattern（直接对话："review 一下 src-tauri/src/types.rs:1766"）时输出 `[file:line] [finding] [evidence] [next step]` 四要素 + 保留原 code 片段 + 不发明 `cfg/impl/req/res/fn` 类缩写。
- 触发 `caveman-help`（直接对话："caveman 能做什么"）时输出 aggregated body 内已声明的能力清单 + 明确标注 `caveman-compress` / `caveman-stats` / `cavecrew` / `caveman-shrink` / `caveman-init` 不可用。
- 安全边界：要求删除分支、覆盖文件、跳过测试、重置 git 状态时，Caveman 输出的安全警告不可被"短句化"压缩。
- `skills-lock.json` 中 `caveman` 的 `computedHash` 与 `SKILL.md` 实际字节 SHA-256 一致；修改 SKILL.md 后 build.rs 必须自动 rerun，并在 lock hash 未同步时 fail closed。
- SKILL.md token 数 ≤ 3000（实际 ~1400），符合 build-time tokenEstimate 校验。
