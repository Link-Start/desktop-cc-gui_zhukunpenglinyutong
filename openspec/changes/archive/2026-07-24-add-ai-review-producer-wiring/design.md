# add-ai-review-producer-wiring — Design

## 1. 调用时机评估(两条路线取舍)

### 路线 A:用户点开语义 diff tab 时按需生成 + 按 turn 缓存(选用)

- **成本**:零默认成本——只有用户真的查看 semantic tab 的 turn 才产生一次 LLM 调用;per-turn cache 保证同一 turn 不重复调用(含失败结果)。
- **延迟**:一次 `engine_send_message_sync` 同步往返(≤60s timeout)。期间规则事实先行渲染,AI facts 到达后合并重算,无阻塞。
- **失败面**:失败仅影响当前查看的 turn,静默降级为纯规则事实;UI 不报错不打断。
- **实现复杂度**:低——触发点就在 `TurnArtifactsSection` 现有的 tab 状态上,无需侵入 turn 生命周期。

### 路线 B:turn 结束时自动生成(放弃)

- **成本**:每个产生文件改动的 turn 都消耗一次 LLM 调用,即使用户从不打开 semantic tab;长会话成本不可控。
- **延迟**:无用户可见延迟,但增加了 turn 收尾的关键路径负担。
- **失败面**:需要 hook 进 turn 完成检测(`useWorkspaceSessionActivity` 的 isProcessing 翻转),跨 thread/child session 场景判断复杂;后台失败需要额外的状态上报通道。
- **实现复杂度**:高,且收益(省一次查看时延迟)不抵成本与风险。

**结论:选路线 A。** 按需生成把成本绑定到真实的用户意图上,失败面最小,且不触碰 turn 生命周期。

## 2. 引擎通道选型

复用 `engineSendMessageSync(workspaceId, { text, engine, autoSession })` 轻量一次性隐藏会话模式,先例:

| 先例 | sessionPurpose | 位置 |
|---|---|---|
| prompt enhancer | `prompt-enhancer` | `usePromptEnhancer.ts` |
| commit message | `commit-message` | `commitMessage.ts` |
| project map | (generation auto session) | `projectMapGenerationWorker.ts` |

本 change:`sessionPurpose: "semantic-diff-review"`,`visibility: "hidden"`,`ownerFeature: "session-activity"`,`autoArchive: true`,`createdBy: "system"`,`accessMode: "read-only"`。`AutoSessionMetadata.sessionPurpose` 为自由字符串(`src/types/conversation.ts:207`),无需注册。

**Engine 选择**:panel 不知道用户当前 provider。沿用 prompt-enhancer 的 claude 主 + codex 兜底先例:主通道 `claude`,失败后静默回退 `codex`;双通道均失败 → 缓存 `null`。不读取用户设置、不新增配置项(保持锚点最小)。

**不选 PR 标题 AI 生成(commit 84b29a36d)路线**:该路线新增 Rust 后端 command(`pull_request_content.rs` 515 行 + command registry + service wrapper),对"读取内存中已有 diff 摘要做轻量 review"过重,违背"不要新造引擎管线"约束。

## 3. 生成契约

### Prompt(`buildTurnSemanticReviewPrompt`)

- 输入:本 turn 的 `SemanticDiffEntry[]`(path/status/diff,跳过 isImage)+ 当前 UI language。
- 预算:每文件 diff 截断至 `MAX_DIFF_CHARS_PER_FILE = 3000`,总 diff 预算 `MAX_TOTAL_DIFF_CHARS = 14000`,超出按文件顺序截断并标注 omitted。
- 指令要点(English 指令 + 按 UI language 输出 fact text):
  - 只输出一个 JSON object,无 markdown fence、无解释。
  - schema:`{"facts":[{"category":"intent|behavior|risk|validation","text":"...","confidence":"high|medium|low","evidence":[{"path":"...","line":123?}]}]}`。
  - 每条 fact 的 evidence path 必须来自给定文件列表;line 取 diff 新文件侧行号(可选)。
  - facts 上限 `MAX_REVIEW_FACTS = 8`;不得臆造文件中不存在的证据;宁可少出不可无证据。

### 解析校验(`parseTurnSemanticReviewResponse`)

- 复用共享 `parseModelStructuredJsonObject`(`src/services/modelStructuredOutput.ts`,带 fence 剥离 + lenient repair),validator 只要求顶层 `{facts: unknown[]}` 形状。
- 逐 fact 校验,任一失败即丢弃该 fact(不整体失败):
  - `category ∈ {intent, behavior, risk, validation}`;
  - `confidence ∈ {high, medium, low}`;
  - `text` 非空 string,截断至 280 字符;
  - `evidence` 至少一条 `path` 属于本 turn 文件集(normalize 后比对);`line` 为可选正整数。
- 映射:`line` 存在 → `SemanticEvidenceRef{type:"diffHunk", id:"${path}:${line}", path, line}`;否则 → `{type:"file", id:path, path}`。
- 整体解析失败(JSON 不存在/无法修复/facts 非数组)→ 返回 `null`(静默降级)。
- 全部 fact 被丢弃 → 返回 `{source:"ai", generatedAt, facts:[]}` 的合法空 review(消费端自然零输出)。

## 4. 成本、缓存与兜底

- **Cache**:module 级 `Map<cacheKey, TurnSemanticReview | null>`,`cacheKey = ${workspaceId}:${turnKey}`;`null` 也缓存(失败/降级结果同样不重复调用)。FIFO 上限 100 条防膨胀。
- **并发去重**:同 key 的 in-flight Promise 挂入 pending map,多个组件实例共享同一请求。
- **兜底链**:claude 失败 → codex;双失败 / 解析失败 / timeout(60s) → `null`;hook 层 `requestTurnSemanticReview` 永不 throw。
- **React 接线**:`useTurnSemanticReview({enabled, workspaceId, turnKey, entries, language})`,`enabled = activeArtifactTab === "semantic"`;完成时一次性 `setState`(event-driven,非高频),符合 render perf 红线(不挂根 hook 链,状态局部于 `TurnArtifactsSection`)。
- **合并**:`TurnArtifactsSection` 内,`aiReview` 到达后用 `buildSemanticDiffSummary({entries, validationEvidence, aiReview})` 重算 `semanticSummary` 并替换 `artifactSummary.semanticSummary`;`buildTurnArtifactSummary` 与其它调用点(TurnGroupSummaryBadges)零改动。

## 5. 测试策略

- `turnSemanticReview.test.ts`:prompt 截断预算;合法 JSON / fenced JSON 解析;无有效 evidence 的 fact 丢弃;非法 category/confidence 丢弃;垃圾文本 / 无 facts 字段 → `null`。
- `useTurnSemanticReview.test.tsx`:mock `engineSendMessageSync`,验证 enabled 时生成一次;同 turnKey 重挂载不重复调用(cache 命中);引擎抛错 → review 为 null 且不 throw、不重复调用。
- `semanticDiffSummary.test.ts`:新增四区分发用例(intent/behavior/risk/validation 各一条带 evidence 的 AI fact,断言全部落位且 `source === "ai"`),既有"无 evidenceRefs 丢弃"用例已覆盖第二条验收。
- 回归:`WorkspaceSessionActivityPanel.test.tsx` 全量(mock 下引擎调用天然降级为 null)。
