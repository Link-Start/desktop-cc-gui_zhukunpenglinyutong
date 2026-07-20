# add-caveman-curated-skill-bundle design

## 1. 背景与约束

- 现有 `lazy-senior-dev` bundled curated skill（`src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md`）已经在客户端跑通完整链路：资源打包 → `skills-lock.json` 注册 → `default_enabled_curated_skill_ids()` 默认开启 → Codex / Claude launch 通过 `developer_instructions` / `--append-system-prompt` / `--append-system-prompt-file` 注入 → Settings UI 暴露 toggle。build.rs 的 lock hash / license / icon / category / tokenEstimate / id 格式校验也已经在 Ponytail 路径上稳定运行。Caveman 与 Ponytail 在 runtime 模型上完全同构，可以全量复用这条流水线。
- 上游 [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) 提供 7 份 SKILL.md：`caveman`（主通信规则）、`caveman-review`（review 输出格式）、`caveman-commit`（commit 输出格式）、`caveman-help`（help 能力描述）、`caveman-compress`（session log 压缩，runtime-only）、`caveman-stats`（token 统计，runtime-only）、`cavecrew`（Caveman-aware subagent 编排，runtime-only）。前 4 份是纯 prompt 内容，后 3 份依赖 hooks / subagent / MCP middleware / 外部脚本，不在本次范围内。
- 仓库契约：curated skill id 必须是 kebab-case ASCII；`tokenEstimate` 必填且 ≤ 3000；`license` 必填；`sourceUrl` 必填；`SKILL.md` 顶部必须含 `<!-- Upstream: ... | License: ... -->` 注释（build.rs 校验）。bundled resource 映射必须保留 `<skill-id>/` 目录结构，禁止 `resources/curated-skills/**/*` glob 映射（Tauri 打包会扁平化丢失目录）。
- 现有 `AppSettings.enabled_curated_skill_ids` 的归一化逻辑（trim / 去重 / drop empty / drop non-kebab）已经能容纳任意新增 id，不需要新写归一化代码。
- Codex macOS / Linux launch：`developer_instructions` 由 ccgui 在 launch 时构造，包含每个 enabled curated skill 的 `<skill id="...">...</skill>` 块；Windows 走 turn-start `collaborationMode.settings.developer_instructions`；所有路径**不**引入新分支。
- Claude Windows launch：`--append-system-prompt-file` 指向的 activation hint 列出 enabled ids，提示 Claude 用 `Skill(skill=...)` 调 native skill；Claude macOS / Linux 走 `--append-system-prompt` 内联 prompt body。新增 `caveman` id 后两条路径都自动含 `caveman`，**不**引入新分支。

## 2. 总体架构

```
                ┌──────────────────────────────────────────────────┐
                │  src-tauri/resources/curated-skills/caveman/      │
                │    ├── SKILL.md      (~1400 tokens)                │
                │    └── metadata.json                              │
                │        (name=caveman, license=MIT, ...)           │
                └────────────────┬─────────────────────────────────┘
                                 │  bundle.resources
                                 ▼
       ┌────────────────────────────────────────────────────┐
       │  build.rs: validate skills-lock.json               │
       │  - sha256(SKILL.md)  ─→  caveman.computedHash      │
       │  - license / icon / category / tokenEstimate 检查  │
       │  - id 格式 kebab-case 检查                         │
       └────────────────┬───────────────────────────────────┘
                        ▼
       ┌────────────────────────────────────────────────────┐
       │  types.rs::default_enabled_curated_skill_ids()     │
       │  vec!["lazy-senior-dev", "caveman"]               │
       │  ← AppSettings.enabled_curated_skill_ids 默认值    │
       └────────────────┬───────────────────────────────────┘
                        ▼
   ┌──────────────────────────────────────────────────────┐
   │  Settings → MCP/Skills → Curated 区                  │
   │  ☐ Ponytail: lazy senior dev                         │
   │  ☐ Caveman                          ← 新增           │
   │  (Settings-only toggle, Composer 不提供 toggle)       │
   └────────────────┬─────────────────────────────────────┘
                    │ enabledCuratedSkillIds = ["lazy-senior-dev","caveman"]
                    ▼
   ┌──────────────────────────────────────────────────────┐
   │  Engine launch injection                              │
   │  - Codex macOS/Linux: launch + turn-start             │
   │    developer_instructions 含当前 authoritative snapshot│
   │  - Codex Windows: turn-start collaborationMode 同上  │
   │  - Claude macOS/Linux: --append-system-prompt 内联    │
   │  - Claude Windows: --append-system-prompt-file 提示   │
   │    Skill(skill="lazy-senior-dev") / Skill(skill=…)    │
   └──────────────────────────────────────────────────────┘
```

## 3. 关键决策

### 3.1 单开关聚合 vs 拆四开关

**first-cut 候选**：把 `caveman` / `caveman-review` / `caveman-commit` / `caveman-help` 各自作为独立 bundled curated entry，Settings 暴露 4 个 toggle。

**最终决策**：合并为单 `caveman` entry，Settings 暴露单 toggle。理由：
- Ponytail `lazy-senior-dev` 的 product model 是"一条政策覆盖所有 code 场景"，Caveman 的 "one cohesive voice" 哲学同样不鼓励"按 task 拆开关"。两条 skill 对齐为单开关模型，用户认知成本最低。
- 默认 `enabled_curated_skill_ids` 平均长度从 `1` 涨到 `2`，没有进一步涨到 `5` 的压力。
- build.rs / skills-lock / Settings UI / Codex launch / Claude launch 五条流水线都"加 1 个 id"而不是"加 4 个 id × 1 个新 resource layout"，diff 最小。
- 用户要临时屏蔽某条 task pattern（如不要 Caveman 的 commit 格式），可在对话里显式说 "don't use caveman commit format"，prompt-level 覆盖更轻量，不必动用 Settings。

### 3.2 聚合范围 vs 上游完整复刻

**first-cut 候选**：把上游 7 份 SKILL.md 全部内容（含 `caveman-compress` / `caveman-stats` / `cavecrew`）一股脑塞进聚合 body。

**最终决策**：聚合范围只覆盖前 4 份纯 prompt 内容，后 3 份在 SKILL.md 内**显式标注** "Runtime-only capabilities (NOT implemented in this client)"。理由：
- 后 3 份依赖 hooks / subagent / MCP middleware / 外部脚本，ccgui 当前没有这些接入点；把它们写进 SKILL.md 但客户端无法真实执行，会诱导模型虚假声称 "我刚刚 compress 了你的 session log"，违反安全契约。
- 显式标注 "NOT implemented" 给后续 change 留 hook：当 hooks / subagent runtime 接入后，再开一个 `add-caveman-runtime-capabilities` OpenSpec change，把它们从 "标注不可用" 升到 "真正可调用"。
- 用户体验角度，诚实声明能力边界比假装全功能更可信。

### 3.3 auto-clarity 边界：五类场景必须还原完整表达

Caveman 默认鼓励压缩 prose，但以下五类场景必须用完整表达，**不**走压缩：
1. **Security warning**：涉及 secrets、credential、auth、permission、token 的风险提示，必须完整保留 "what / why / how to mitigate" 三段式。
2. **Irreversible action**：删分支、`git reset --hard`、`rm -rf`、force push、覆盖文件、跳过测试提交等不可逆动作，必须保留 confirmation 步骤。
3. **Ambiguous intent**：用户意图可能有多解、prompt 触发歧义时，恢复 question 形式而非省略。
4. **Multi-step sequence**：超过 1 步的操作序列保留步骤编号与依赖关系，避免被压成单句让用户看不清顺序。
5. **User confusion / correction signal**：用户表示不理解、说"等等"、纠正之前的描述时，恢复完整解释。

这五类场景在 SKILL.md 的 "Clarity/safety boundaries" 段明确写出，并附 `[thing] [action] [reason]. [next step].` 句式在常规场景下的使用规则作为对照。

### 3.4 invented prose abbreviation 黑名单

禁止模型在追求短句时发明以下缩写：
- `cfg` 替代 "configuration"
- `impl` 替代 "implementation"
- `req` 替代 "requirement" / "request"
- `res` 替代 "response" / "result"
- `fn` 替代 "function"（在 prose 内；code 内 `fn` 是 Rust keyword，保留）

以及禁止用 `→` 箭头替代因果 / 依赖描述（"A → B" 必须写成 "A causes B" 或 "A, then B"）。

理由：这些缩写在 chat / slack 风格的对话里被滥用，但在 technical documentation / commit message / review feedback 场景会让用户看不懂，违反 "preserve technical substance"。

### 3.5 commit message skill 不自动 `git commit`

`caveman-commit` 的 SKILL.md 内容只生成 ready-to-use commit message 文本（`type(scope): 中文动宾短句` 模板 + body），**不**自动执行 `git commit`。理由：
- 与现有 `lazy-senior-dev` 的边界一致：Ponytail 不自动 commit，Caveman 也不自动 commit。
- 自动 commit 会越过 settings 层的 "Codex launch 携带 curated skills" 模型，引入新的 runtime 副作用（commit hook / git config 改写 / 分支切换）。
- 用户明确点击 commit 按钮才触发，与现有 Git History 面板的 commit message 生成按钮行为对齐。

### 3.6 skills-lock.json single source

repo 根 `skills-lock.json` 是唯一 lock source。`src-tauri/build.rs` 从 parent repo root 读取它，runtime loader 在 development 与 packaged layout 下也解析同一份内容；仓库不存在 `src-tauri/skills-lock.json` 副本。新增 `caveman` entry 时只更新根 lock，`computedHash` 由维护者按 `SKILL.md` 实际字节更新；build.rs 使用 Rust `sha2` 重新计算并比对，hash 漂移时 fail closed，而不是自动改写 lock。

### 3.7 tokenEstimate 估算

`SKILL.md` 实际大小 ~1400 tokens（按 OpenAI `cl100k_base` 估算）。远低于 build.rs 上限 3000。预留 buffer 用于未来小幅增强（如多语言示例、few-shot 对照），但**不**预留 buffer 给 runtime-only capability 的伪 prompt——那些能力不写进 body，只在 "NOT implemented" 段一句话标注。

### 3.8 默认开启的 one-shot migration

仅修改 serde default 无法覆盖已有安装：旧 settings 已经显式持久化 `["lazy-senior-dev"]`，字段并不缺失。`AppSettings.curatedSkillDefaultsVersion` 作为 migration marker：fresh default 为 `1`，旧 settings 缺字段时 deserialize 为 `0`。`storage::read_settings()` 在 `version < 1` 时，对非空 curated 列表补入 `caveman` 并把 marker 升到 `1`；显式空数组继续代表用户关闭全部 curated skills，不补入默认值。用户在 migration 后关闭 Caveman 时，settings 连同 marker `1` 持久化，后续启动不会重新开启。

### 3.9 Curated description i18n

`metadata.json.description` 保持 English canonical fallback，避免 backend resource schema 引入 locale 分支。Settings row 以 stable skill id 映射 `common.curatedSkillDescription*` key；已知 bundled skill 使用当前 locale 文案，translation 缺失或未知 skill 直接回退 metadata description。这样不改变 IPC payload，也不为每种语言复制 metadata asset。

### 3.10 Codex 同 thread 的 authoritative curated snapshot

只重启 app-server 不等于清除 Codex thread history：settings restart 会替换 workspace runtime，但下一 turn 仍可能通过 `thread/resume` 使用原 `threadId`。如果 disabled state 仅表现为“不再生成 `<skill>` block”，旧轮次中的 bundled curated instructions 仍可能被模型继续采用。

因此 `codex_curated_skills_developer_instructions_block()` 每次都生成 authoritative snapshot：

- snapshot 明确声明只有本 section 中列出的 ccgui bundled curated skill 生效；旧轮次中未列出的 bundled skill 已失效。
- 部分启用时，输出当前 enabled ids 与对应 `<skill>` blocks；被关闭的 id 通过“未列出即失效”撤销。
- 全部关闭时仍输出 `Enabled: none`，不能返回 `None`。
- snapshot 只约束 ccgui bundled curated skill，不撤销用户自定义 `developer_instructions`、system instructions 或通过其他机制按需调用的 skill。
- macOS / Linux 保留既有 spawn-time argv 注入；desktop、shared session 与 daemon 的每次 Codex `turn/start` 在所有平台都通过 `collaborationMode.settings.developer_instructions` 注入同一个最新 snapshot。Windows 仍只走 turn-level transport，避免大型 body 进入 process argv。
- `WorkspaceSession` 记录 launch args 是否含用户显式 `developer_instructions` / `instructions` override；存在 override 时 spawn 与 turn-level generated transport 都让位，保持原有 precedence。

该方案保留原 thread 与可见历史，不需要 fork / start 新 thread，也不伪装成能从磁盘删除历史指令；它在 next turn 使用更新的同级 developer instruction 明确覆盖 bundled curated enablement state。仅重启 macOS / Linux app-server 并重新 resume thread 不足以更新 thread 已持有的 developer state，因此 turn-level snapshot 不能限定为 Windows。

## 4. 风险与回退

| 风险 | 缓解 | 回退 |
|---|---|---|
| 用户对 Caveman 短句风格不适应 | 单一 Settings toggle；Codex runtime restart 后向同一 resumed thread 注入 authoritative snapshot | 关闭后 snapshot 不再包含 Caveman，并明确撤销旧 bundled block |
| SKILL.md 聚合后与上游漂移 | `sourceUrl` 字段直指 upstream repo；版本号 1.0.0 起步；后续 followup 改 SKILL.md 时人工核对上游 diff | 关闭 toggle 即可回退；不需要清代码 |
| 聚合 body 漏掉上游重要规则 | 1.1 / 1.2 任务专门做"核对上游 4 份 SKILL.md 真实内容"；tasks.md 4.1 把"aggregation 范围"写进 spec delta 的 Scenario | 漏掉的规则在 followup change 中追加 |
| auto-clarity 边界被模型忽略 | SKILL.md "Clarity/safety boundaries" 段明确列出 5 类场景 + 黑名单 + 句式对照 | 用户报单点退化时，在 SKILL.md 内追加"必须"前缀 |
| runtime-only capability 被模型虚假声称 | SKILL.md "Runtime-only capabilities (NOT implemented in this client)" 段显式标注；spec delta Scenario `runtime-only capability is not fabricated` 写入主 capability | followup change 引入真实 runtime 接入 |

## 5. 与 Ponytail `lazy-senior-dev` 的互补性

- Ponytail 关注 **code 维度**：少写代码、复用既有 helper、最小改动、bug = 根因。
- Caveman 关注 **prose 维度**：短句、保留 code / commands / identifiers、禁 invented abbreviation、5 类场景还原完整表达。
- 两条 prompt 注入到 `developer_instructions` 后，模型在 code 改动时遵守 Ponytail，在 prose 沟通时遵守 Caveman，互不冲突。`type(scope): 中文动宾短句` commit message 同时满足：Ponytail（最小 diff）+ Caveman（短句但保留 code / commands / paths）。
- Settings 两条独立 toggle：用户可单独关 Caveman（保留 Ponytail 的 code 哲学）而不影响最小代码策略，反之亦然。
