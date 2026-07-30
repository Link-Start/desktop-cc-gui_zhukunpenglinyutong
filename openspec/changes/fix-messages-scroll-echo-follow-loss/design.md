# Design: fix-messages-scroll-echo-follow-loss

## Context

消息画布底部跟随依赖 `autoScrollRef`（armed 状态）+ 收敛 run（`startConversationScrollConvergence`）+ 程序化回声指纹环（bounded 32，±2px）。WKWebView 的 scroll 事件异步派发：内容高度塌缩（虚拟化 48→16 门槛翻开、live 尾窗裁剪）时浏览器先钳位 `scrollTop`，钳位/写入产生的事件在几何继续变化后才送达。

改动前的两条误判路径：

1. **run 结束后无豁免**：回声判定要求 `activeProgrammaticEdge != null`；convergence `onComplete` 清空 edge 后，迟到的回声事件直接走"用户上滚"语义 → `autoScrollRef=false` + `cancelScrollConvergence`。
2. **钳位目标逃出指纹环**：指纹环只记录已观察/已写入的值；塌缩后的新 max scrollTop 是新出现的值，钳位事件未命中即误判。

第一版 review 又识别出两个设计缺口：

1. number-only ring + 全局 `lastProgrammaticScrollWriteAt` 会让一次新 observation 续活整环旧 fingerprint。
2. `onFrameObservation` 即使没有写 `scrollTop` 也更新时间戳，测试把 no-op observation 误称为 write；keyboard/touch/pointer 的真实输入在 grace 内仍可能被吞。

约束：不得改变"用户真实上滚即解除跟随"的产品语义（既有测试 `stops following streaming growth once the user scrolls up`、`does not re-pin on settle back-fill when the user has scrolled up` 编码了该语义）；改动限定 messages feature 内部。

## Goals / Non-Goals

**Goals:**

- run 完成后，实际 write/clamp 对应的独立 fingerprint 在 350ms grace 内命中时按回声豁免。
- 浏览器钳位必须由前后 geometry 证明，不能把每次 ResizeObserver observation 都伪装成 clamp。
- user intent 是更高优先级证据；wheel、keyboard、touch、pointer/scrollbar 后续 scroll 即使命中 fingerprint 也按用户滚动处理。
- no-op convergence 与不相关新 write 不得续活旧 fingerprint。
- 回声落在底部时武装跟随（用户滚回底部撞中钳位指纹也能恢复）。
- 切会话时指纹环与时间戳清零，杜绝跨会话残留碰撞。

**Non-Goals:**

- 不改虚拟化阈值/估高/remeasure 策略，不改收敛算法。
- 不要求 WebView 提供 `scrollend`；输入租约覆盖当前目标平台的 wheel、keyboard、touch 与 pointer/scrollbar。
- 不触碰 shared projection 数据源。

## Decisions

### D1: fingerprint 自带 freshness 与 source

```typescript
type ProgrammaticScrollFingerprint = {
  scrollTop: number;
  recordedAt: number;
  source: "write" | "clamp";
};
```

- ring 仍 bounded 32；同位置新证据替换旧 entry 并移到尾部。
- `isProgrammaticScrollEcho` 只检查命中的 entry：活跃 run 内允许命中；run 外要求 `now - entry.recordedAt <= 350ms`。
- 禁止全局 `lastWrite` 为所有 entry 提供 freshness。旧 fingerprint 不会被不相关新 write/observation 续活。
- 350ms 仍是 bounded delivery grace，不再承担“猜用户是否滚动”的职责。

### D2: 只有实际 convergence write 才记录 write fingerprint

- `onFrameObservation(observed, applied)` 中仅当 `|applied-observed| > tolerance` 时记录 `applied`。
- settled frame、recheck pulse 与 no-op observation 不生成 post-write evidence。
- 前一次 write 的 applied value 已在发生时记录，不需要把下一帧 observed value再次伪装成新 write。

### D3: clamp fingerprint 需要 geometry proof

ResizeObserver 保存前一帧：

```typescript
type ScrollGeometrySnapshot = {
  maxScrollTop: number;
  scrollTop: number;
};
```

只有同时满足以下条件才记录 `clamp`：

1. `next.maxScrollTop < previous.maxScrollTop`；
2. `previous.scrollTop > next.maxScrollTop + tolerance`，证明旧位置越界；
3. 当前 `scrollTop` 接近 `next.maxScrollTop`，证明浏览器已钳位。

首次 observation、内容增长、普通 remeasure 或用户停在中间位置都只更新 snapshot，不产生 clamp fingerprint。

### D4: user intent 优先于 echo heuristic

- 建立 bounded user-intent lease，来源覆盖：
  - `wheel`
  - scrolling keys（`ArrowUp/Down`、`PageUp/Down`、`Home/End`、`Space`），忽略 editable target
  - `touchstart/touchmove`
  - `pointerdown` + active pointer（覆盖滚动条拖拽）
- user-intent lease active/recent 时，`updateAutoScroll` MUST 跳过 echo 豁免，按实时 `isNearBottom` 更新 `autoScrollRef`，上滚时取消 convergence。
- user intent 不直接永久锁死跟随；用户回到底部仍按既有 near-bottom 语义重新武装。
- scope switch/unmount 清理 listener、active pointer/touch 与 lease。

### D5: 底部 echo 仍可武装跟随

- 无 user intent、无活跃 run、合法 echo 落在 near-bottom 时 `autoScrollRef.current = true`。
- 这是 recovery 行为，不得覆盖 D4 的用户输入优先级。

### D6: 收尾 repin 守卫维持 `autoScrollRef`

- 不把 turn-settle 改成只识别 wheel 的第二套 authority。
- 所有输入统一在 D4 转成 user-intent evidence；`autoScrollRef` 仍是 convergence/settle 的唯一 armed 状态。

### D7: 测试必须证明 protocol phase

- pure helper：per-entry grace 边界、旧 entry 不被新 entry 续活、user intent 优先、clamp geometry Good/Base/Bad。
- component regression：初始位置必须偏离 target，证明发生实际 write；使用 fake clock / deterministic rAF 先观察 `onComplete`，再在 grace 内触发 echo。
- negative regression：no-op convergence 不开启 grace；keyboard/touch/pointer 在 grace 内命中 fingerprint 仍释放跟随。

### D8: adaptive timeline rendering fail closed

复验确认：截图中的 lightweight prompt 只是 render-weight policy 的可见提示；真正的跳顶发生在同一 threshold 令 TanStack virtualizer 从 `enabled=false` 切到 `enabled=true` 时。virtual-core 在 disabled 期间清空 `scrollOffset`，重新 attach scroll element 时以默认 `initialOffset=0` 同步 `_scrollToOffset(0)`；现有 passive-effect remeasure / bottom convergence 发生得更晚，无法保证保留原 viewport anchor。

当前版本采用单一 compile-time kill switch：

- `shouldVirtualizeTimelineRows` 对所有 row-count/render-weight/streaming 状态返回 false；
- lightweight policy 对 suggested/oversized 返回 false，manual/legacy state 也解析为 inactive；
- `MessagesTimeline` 因此只进入 static viewport，heavy rows 全部使用 full-detail renderer；
- 既有 virtualization/lightweight 实现保留但不可达，避免在未具备 transition contract 时由设置、旧状态或 sibling caller 绕过。

重新启用的前置条件：必须先加入 static → virtual `initialOffset` handoff、remeasure 后 anchor compensation、bottom-armed 与 mid-history 两类 discriminating regression，再显式翻转 kill switch。

## Risks / Trade-offs

- [350ms 后仍到达的真实程序化 echo 无法证明来源] → fail open to user control：按真实位置处理；不得无限扩大 grace 或复活旧 entry。
- [keydown 可能来自其它输入面] → 只接受 scrolling key、排除 editable target，并要求 scroller active/focused/hovered；避免全局快捷键污染。
- [pointerdown 可能是消息内容点击而非滚动条] → 它只建立短租约且必须后续真的出现 scroll 才生效，不直接改变 `autoScrollRef`。
- [background tab timer throttling] → per-entry timestamp 使用 monotonic clock；恢复前台后过期 echo 按当前位置处理，后续合法 content signal/near-bottom 可重新武装。
- [环 churn] → 只记录 actual write/proven clamp，显著少于第一版“每个 RO 两条 + 每帧 observation”；bounded 32 足够且不会靠全局续期掩盖容量问题。
- [禁用 virtualization/lightweight 增加重型历史渲染成本] → 这是 product owner 明确选择的 correctness-first containment；保留 render-weight diagnostics 与历史实现，重新启用必须先通过 D8 的 transition gate。

## Migration Plan

纯前端行为修复，无数据/存储迁移。回滚 = revert 本变更涉及的 helper/hook/component/tests 与 OpenSpec artifacts，无残留状态。

## Open Questions

- 无。review 指出的 causal ownership、用户输入优先级与 deterministic test 均纳入本 change，不再下放后续专项。
