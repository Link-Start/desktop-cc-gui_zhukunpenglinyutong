# modernize-prompt-enhancer-and-curated-skills-refresh

## Why

`docs/reports/composer-prompt-stack-optimization-impact-2026-07-25.md` 第三批（体验升级）：

- **#7 prompt enhancer 粗糙**：英文硬编码 system prompt 对中文输入无语境优化；同文本重复润色重复付 token（无缓存）；错误分类靠 `message.includes(needle)` 子串匹配，超时/引擎错误/空结果混为一谈，fallback 重试决策脆弱；失败文案英文硬编码直出 UI。
- **#8 curated-skills 空转轮询**：`CuratedSkillIndicator` 可见状态下每 2s 轮询低频静态设置数据，违反仓库"事件驱动 + ≥30s 兜底轮询，禁秒级轮询"红线。

## What Changes

### prompt enhancer（#7）

- system prompt 按界面语言本地化（zh/zh-TW 中文指令，其余英文）。
- 结果缓存：以 `hash(text + engine + model + locale)` 为键的模块级 LRU（20 条），命中即秒回、零 token。
- 错误分类结构化：引入 `PromptEnhancerError`（kind: `timeout` / `workspace` / `empty` / `engine`）；超时经 typed error 传播而非文案；重试 fallback 决策基于 kind + 集中式 classifier（单测覆盖）。
- 失败文案走 i18n（10 个 locale 补齐），不再英文硬编码直出。

### curated-skills（#8）

- Rust `set_curated_skill_enabled` 成功后 emit `curated-skills-changed`。
- `CuratedSkillIndicator` 删除 2s 轮询：初始加载 + 事件订阅 + 60s visibility-gated 兜底。

## 目标与边界

- enhancer hook 对外 contract（`UsePromptEnhancerReturn`）不变，UI 组件无结构性改动。
- curated indicator props/视觉 contract 不变。

## 非目标

- **token 级流式输出与就地 diff 替换 UI**：隐藏 session 的流式通道依赖进行中的 `enable-claude-lightweight-streaming-and-frame-attribution`，并行另建流式链路会与该 change 冲突；待其落地后接续。
- curated-skills 基础设施（锁文件/build.rs 校验/注入管线）拆除：见方案取舍。
- 发送前自动润色开关。

## 方案取舍

### #8 路线决策：路线 B（降级）方向，本批次先落地无争议部分

报告要求"扩容 or 降级"产品决策。决策：**采用路线 B（降级）方向**——2 个 bundled skill 不配拥有锁文件+build.rs 校验+独立注入管线，长期应退化为静态资源并收敛到 Skills Hub 统一管线。但拆除基础设施是独立大改（涉及 build.rs、注入管线、Skills Hub 迁移），不在本批次边界内。本批次落地两条路线共同要求的部分：**事件驱动替代 2s 轮询**，并在 design.md 记录路线 B 的后续拆除清单。

### 错误分类：边界处结构化，引擎字符串集中归类一次

Tauri invoke 错误以字符串越过边界，无法获得引擎错误码。方案：在**我们自己产生错误的位置**（超时、workspace 未就绪、空结果）使用 typed error（kind 明确，不再依赖文案匹配）；引擎侧字符串由唯一一个 `classifyPromptEnhancerError` 集中归类为 kind，重试决策只读 kind。分类规则变更收敛为单点 + 单测。

### 缓存键不含 timeout

timeout 只影响等待上限，不影响结果内容，不参与缓存键。

## Capabilities

- `composer-prompt-enhancer`（新增）
- `curated-skills-settings-sync`（新增）

## Impact

- `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.ts` + 测试
- `src/i18n/locales/*/promptEnhancer.ts`（10 locale）
- `src-tauri/src/curated_skills.rs`
- `src/features/curated-skills/components/CuratedSkillIndicator.tsx` + 测试
- `src/features/curated-skills/utils/`（事件订阅 helper）

## 验收标准

1. 中文界面下 enhancer system prompt 为中文指令；英文界面保持英文。
2. 同一文本+引擎+模型+语言二次润色零 IPC、即时返回。
3. 超时错误经 typed kind 传播；fallback 重试决策不读错误文案。
4. enhancer 失败文案随界面语言本地化。
5. `CuratedSkillIndicator` 无秒级轮询；设置 toggle 后指示器经事件秒级内刷新；60s 兜底仍在。
6. typecheck / lint / 相关 Vitest / cargo test / openspec validate 通过。
