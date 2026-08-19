## 1. Mux / history 投影

- [x] 1.1 `project_session_projection` 接 `todos`
  - 输入：`src-tauri/src/engine/dsh/events.rs`
  - 输出：`key=todos` → 可被 frontend 识别的事件（建议 `EngineEvent::Raw { kind: "dsh-todos", todos }`，避免污染 billed UsageUpdate）
  - 验证：cargo test：非空数组、空数组、缺字段
  - 依赖：无；优先级 P0

- [x] 1.2 同函数接 `contextPressure` / `contextBreakdown`
  - 输入：同上
  - 输出：合并进该 thread 的 usage：分子=`projectedTokens ?? pressureTokens`，分母=`contextWindow`，三分类 → `contextCategoryUsages`
  - 验证：cargo test：只有 pressure 不丢 billed；只有 tokenUsage 不把占用写成 None
  - 依赖：1.1 的 merge 约定；优先级 P0

- [x] 1.3 history page 从 `projections.values` 播种 todos + pressure + breakdown
  - 输入：`src-tauri/src/engine/dsh/history.rs` `usage_from_history_page` / load DTO
  - 输出：`load_dsh_session` 带回 snapshot，freshness=`restored`
  - 验证：history 单测：values 里有 todos/pressure 时 frontend hydrate 有值
  - 依赖：1.1、1.2；优先级 P0

## 2. Frontend 任务条

- [x] 2.1 DSH thread todos snapshot：`null` / `[]` / items
  - 输入：`useAppServerEvents` + thread reducer；history hydrate
  - 输出：live Raw / history DTO 写入 `todosByThread[threadId]`
  - 验证：vitest：空数组不回退；null 才回退
  - 依赖：1.1、1.3；优先级 P0

- [x] 2.2 Composer DSH 任务 pill 优先 snapshot
  - 输入：`Composer.tsx` / `useComposerRunStatus`
  - 输出：`snapshot !== null` 用投影；`null` 用 `useStatusPanelData` 扫描
  - 验证：vitest 或现有 run-status 测试补 DSH 分支
  - 依赖：2.1、`fix-todo-write-file-change-misclassify`；优先级 P0

## 3. Frontend 上下文占用

- [x] 3.1 merge 规则：tokenUsage 帧不覆盖占用字段
  - 输入：`useAppServerEvents` / `normalizeTokenUsage` / thread token usage reducer
  - 输出：三类投影独立 last-wins
  - 验证：既有 `useAppServerEvents.tokenUsage.test.tsx` 不回归；新增 DSH merge 用例
  - 依赖：1.2；优先级 P0

- [x] 3.2 DSH 占用卡：百分比 + `~used / window` + 三分类
  - 输入：`Composer.tsx` view model、`TokenIndicator` / 抽一层 occupancy card、i18n
  - 输出：DSH 显示分类行；Claude 卡仍无分类行
  - 验证：ContextBar / TokenIndicator 测试：DSH 有三行 `~`；缺窗口不画 0%；Claude 用例不变
  - 依赖：3.1；优先级 P0

- [x] 3.3 底栏 stats 仍只读 sessionStats + billed tokenUsage
  - 输入：`dshSessionStats.ts` 调用点
  - 输出：占用投影不改 TTFT / tok/s / cache
  - 验证：既有 `dshSessionStats` 测试绿
  - 依赖：3.1；优先级 P1

## 4. 回归、ADR、索引

- [x] 4.1 focused cargo（dsh events/history）+ vitest（events / Composer context / run-status）
  - 验证：全绿
  - 依赖：1–3；优先级 P0

- [x] 4.2 回写基石 ADR 校准表 DSH projection 行
  - 输入：`docs/research/mossx-multi-cli-provider-session-foundation-design.md`
  - 输出：注明 `todos` / `contextPressure` / `contextBreakdown` 事实源路径
  - 验证：archive 前可核对
  - 依赖：实现落地；优先级 P1

- [x] 4.3 更新 `openspec/changes/README.md` active 行
  - 验证：两枚 change id 可点
  - 依赖：artifacts 齐；优先级 P2

- [ ] 4.4 手测（不 archive）：同一 DSH session 并排 mossx 与 `dsh web`
  - 验证：任务文案/计数同步；新 turn 清空；占用 % 与 ~used/window 接近；三行存在且不要求加总相等；重开会话恢复
  - 依赖：4.1；优先级 P0
