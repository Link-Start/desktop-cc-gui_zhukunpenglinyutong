## 任务清单

### 1. enhancer 错误结构化

- [x] 1.1 [P0][Depends: none][Input: `usePromptEnhancer.ts` 错误处理全链路][Output: `PromptEnhancerError`（kind: timeout/workspace/empty/engine + retryable）、typed timeout、集中 classifier、fallback 决策改读 kind][Verify: 单测覆盖 kind 映射与 fallback 决策]

### 2. enhancer 本地化与缓存

- [x] 2.1 [P0][Depends: none][Input: `buildPromptEnhancerInstruction`][Output: locale 参数（zh/zh-TW 中文指令），hook 经 i18n 当前语言传入][Verify: 单测断言中英文指令选择]
- [x] 2.2 [P0][Depends: 1.1][Input: `handleRunPromptEnhancement`][Output: 模块级 LRU（20 条，键=locale|engine|model|text），命中秒回零 IPC；失败不缓存][Verify: 单测：同键第二次调用无 engineSendMessageSync]
- [x] 2.3 [P1][Depends: 1.1][Input: 失败文案常量 + `promptEnhancer` locale][Output: 失败展示走 `resolveEnhancerFailureCopy(t, error)`，10 locale 新增 `failedTimeout/failedWorkspace/failedEmpty/failedGeneric`][Verify: locale parity 测试通过]

### 3. curated-skills 事件化

- [x] 3.1 [P0][Depends: none][Input: `src-tauri/src/curated_skills.rs`][Output: toggle 成功 emit `curated-skills-changed`][Verify: cargo test curated 通过]
- [x] 3.2 [P0][Depends: 3.1][Input: `CuratedSkillIndicator.tsx`][Output: 删除 2s 轮询；`subscribeCuratedSkillsChanged` helper + 事件刷新 + 60s visibility-gated 兜底][Verify: 单测：事件触发刷新、2s 处无 IPC、60s 兜底触发]

### 4. 跨层验证与交付

- [x] 4.1 [P0][Depends: 2.3, 3.2][Input: 全部改动文件][Output: typecheck / lint / 相关 Vitest / cargo test 全绿][Verify: 各 gate 命令通过]
- [x] 4.2 [P1][Depends: 4.1][Input: OpenSpec artifacts][Output: proposal / design / tasks / specs 补全][Verify: `openspec validate modernize-prompt-enhancer-and-curated-skills-refresh --strict --no-interactive`]

### 5. Review-Discovered Closure

- [x] 5.1 [P1][Depends: review][Input: review 发现项][Output: 修复或记录 waiver][Verify: 二次 review 通过]
