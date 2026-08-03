# conversation-render-surface-stability Specification

## Purpose

Defines the conversation-render-surface-stability behavior contract, covering Claude Live Conversation Rendering MUST Degrade Safely On Desktop Surfaces.
## Requirements
### Requirement: Claude Live Conversation Rendering MUST Degrade Safely On Desktop Surfaces

当 Claude 会话处于 live processing 且消息幕布进入高频 realtime 更新时，系统 MUST 启用 render-safe degradation，避免消息区出现闪白、整块空白或需要切换线程才能恢复的状态。

#### Scenario: transcript-heavy Claude history restore keeps a readable surface

- **WHEN** 当前会话引擎为 `claude`
- **AND** 当前幕布承载的是 history restore / reopen 后的非 realtime conversation
- **AND** 该会话以 `reasoning` / `tool` transcript 为主而普通 assistant 正文极少
- **THEN** render surface MUST 保留至少一个可读 transcript surface
- **AND** 系统 MUST NOT 将该会话直接渲染为空白或 empty-thread placeholder

### Requirement: Claude Render Safety MUST Preserve Progressive Assistant Text Visibility

Claude render-safe behavior MUST protect live assistant text visibility in addition to preventing blank or flashing conversation surfaces.

#### Scenario: render-safe mode keeps live assistant text progressing
- **WHEN** current conversation engine is `claude`
- **AND** the conversation is processing
- **AND** assistant text deltas continue to arrive
- **THEN** render-safe mode MUST keep the live assistant message visibly progressing
- **AND** the message surface MUST NOT degrade to a spinner-only or first-few-characters-only state until completion

#### Scenario: render-safe degradation does not suppress meaningful live text
- **WHEN** Claude render-safe mode disables high-risk visual effects, animations, or render optimizations
- **THEN** those degradations MUST prioritize preserving readable live assistant text
- **AND** the system MUST NOT solve blanking by hiding or deferring all intermediate assistant content until the terminal event

#### Scenario: a shorter degraded stub does not overwrite the last readable live assistant surface
- **WHEN** `Claude` render-safe mode is active during processing
- **AND** the current turn had already rendered a more readable assistant body
- **AND** the current live surface regresses to a shorter prefix-only stub under visible stall evidence
- **THEN** render-safe recovery MUST keep the last more-readable same-turn surface available
- **AND** the shorter stub MUST NOT overwrite the preserved readable surface as the only visible body

### Requirement: Render Safety MUST Follow Normalized Conversation Processing State

渲染安全策略 MUST 以归一化 `conversationState` 为准，不得依赖可能滞后的 legacy props，避免 render-safe mode 漏触发。

#### Scenario: normalized state overrides stale legacy thinking flag

- **WHEN** `conversationState.meta.isThinking` 为 `true`
- **AND** legacy `isThinking` prop 仍为 `false` 或尚未同步
- **THEN** 消息幕布 MUST 仍按 processing conversation 处理
- **AND** render-safe mode MUST 依据 normalized state 正常启用

#### Scenario: normalized state shutdown exits render-safe mode

- **WHEN** `conversationState.meta.isThinking` 变为 `false`
- **THEN** 消息幕布 MUST 退出 realtime-specific render-safe mode
- **AND** 历史浏览与普通 completed conversation 渲染 MUST 恢复到非 processing 行为

### Requirement: Render Safety MUST Remain Claude-Scoped Unless Another Engine Opts In

本能力 MUST 以 Claude live conversation 为主治理对象，不得误伤 Codex、Gemini、OpenCode 的现有视觉与交互契约。

#### Scenario: codex path does not inherit claude-only degradation

- **WHEN** 当前会话引擎为 `codex`
- **AND** 未显式声明复用 Claude render-safe contract
- **THEN** 系统 MUST NOT 自动套用 Claude 专属 render-safe mode
- **AND** Codex 既有 stream、timeline 与 working indicator 行为 MUST 保持不变

#### Scenario: desktop platform handling is not hard-coded to windows only

- **WHEN** 当前会话引擎为 `claude`
- **AND** 应用运行在任一 desktop WebView surface，例如 Windows 或 macOS
- **THEN** render-safe strategy MUST 通过统一的 desktop surface contract 判定是否启用
- **AND** 系统 MUST NOT 将安全降级能力写死为 Windows-only 样式分支

### Requirement: Live Conversation Rendering MUST Derive From A Bounded Tail Working Set

When history is collapsed for an active live conversation, message rendering MUST perform expensive presentation derivation on a bounded tail working set instead of the complete thread history. When the user explicitly expands history, the renderer MUST leave the bounded collapsed window and derive the full history even while the conversation remains active.

#### Scenario: live collapsed history uses bounded working set
- **WHEN** a live conversation is processing
- **AND** `showAllHistoryItems` is disabled
- **AND** the conversation contains more items than the visible history window
- **THEN** filtering, reasoning dedupe/collapse, and timeline collapse MUST operate on a bounded tail working set
- **AND** the final rendered result MUST preserve the same visible latest conversation content

#### Scenario: collapsed history count includes omitted working-set prefix
- **WHEN** items before the live working set are omitted from presentation derivation
- **THEN** the collapsed history count MUST include those omitted items
- **AND** users MUST still see an accurate affordance that earlier history is hidden

#### Scenario: sticky live user message remains available
- **WHEN** the latest ordinary user message is outside the tail working set
- **THEN** the renderer MUST retain that user message as the sticky live question candidate
- **AND** the message MUST NOT be lost solely because working-set trimming was applied

#### Scenario: show all history keeps full derivation
- **WHEN** the user enables full history display
- **THEN** the renderer MUST keep using the full conversation item list for presentation derivation
- **AND** working-set trimming MUST NOT hide or reorder history

#### Scenario: live history reveal exits bounded trimming immediately
- **WHEN** an active live conversation displays the collapsed-history control
- **AND** the user activates “show previous N messages”
- **THEN** the renderer MUST expose the previously omitted history during the active turn
- **AND** the collapsed-history control MUST disappear after the full-history window is active

### Requirement: Three-Engine Live Rendering MUST Preserve Progressive Visible Text
Live rendering for Codex, Claude Code, and Gemini MUST preserve progressive visible assistant text while allowing bounded throttling and safe degradation.

#### Scenario: conversation turn boundaries use locale-driven labels
- **WHEN** the curtain renders reasoning or final-message turn boundaries
- **THEN** user-visible labels MUST come from i18n resources
- **AND** the labels MUST update when the active locale changes
- **AND** the renderer MUST NOT hardcode Chinese copy as the primary production UI source

#### Scenario: generated image cards use locale-driven visible copy

- **WHEN** the curtain renders generated image title, status, hint, or preview action labels
- **THEN** those user-visible labels MUST come from i18n resources
- **AND** the renderer MUST NOT keep component-local hardcoded Chinese fallback copy for those surfaces

#### Scenario: agent badge accessibility label follows locale

- **WHEN** the curtain renders a user message agent badge toggle
- **THEN** its accessible label MUST come from i18n resources
- **AND** the label MUST include the selected agent name through interpolation when available

#### Scenario: visible text growth is tracked by live assistant item
- **WHEN** any supported engine receives assistant text deltas for a live item
- **THEN** visible text diagnostics MUST be keyed by thread and item id
- **AND** the client MUST use actual rendered value growth or equivalent visible surface evidence instead of parent array render count as proof that the user saw new text

#### Scenario: completed streaming output converges locally to final Markdown
- **WHEN** a streaming assistant message completes after using throttled Markdown, staged Markdown, or plain-text live fallback
- **THEN** the local realtime render path MUST converge to final Markdown semantics
- **AND** the client MUST NOT depend on history replay or thread switching to restore headings, lists, code blocks, links, or emphasis

### Requirement: Live Render Work MUST Stay Scoped To The Active Tail When Possible
Live message rendering MUST avoid global presentation recomputation when only the active streaming tail changes.

#### Scenario: unchanged history is not reprocessed for each streaming chunk
- **WHEN** a live conversation receives high-frequency assistant, reasoning, or tool deltas
- **AND** collapsed history or live tail working-set rules allow bounded presentation
- **THEN** expensive filtering, reasoning collapse, timeline collapse, Markdown parse, and scroll work MUST remain scoped to changed live rows where possible
- **AND** unchanged history rows MUST keep stable render inputs

#### Scenario: stable timeline snapshot coexists with live row override
- **WHEN** the active streaming assistant item continues to grow or flips from non-final to final
- **AND** the renderer maintains a deferred presentation snapshot for timeline-heavy derivations
- **THEN** the live assistant row MUST still receive the latest visible text and final-state semantics immediately
- **AND** anchors, grouped timeline entries, sticky header candidates, and final-boundary derivations MAY converge on the deferred snapshot instead of recomputing on every delta
- **AND** the renderer MUST naturally converge back to the canonical latest presentation state after streaming settles

### Requirement: Conversation Curtain MUST Render Deferred Claude Images Safely

The conversation curtain MUST render deferred Claude history images as explicit user-action placeholders and MUST NOT eagerly allocate large image bytes.

#### Scenario: deferred image placeholder is visible and stable
- **WHEN** restored Claude history contains a deferred image descriptor
- **THEN** the conversation curtain MUST render a stable placeholder that communicates the image is available on demand
- **AND** rendering the placeholder MUST NOT require the base64 payload to be present in frontend state

#### Scenario: loading one deferred image does not blank the curtain
- **WHEN** the user loads a deferred Claude image
- **THEN** the curtain MUST preserve the existing transcript rows during the load
- **AND** success or failure MUST update only the targeted image placeholder surface
- **AND** the conversation MUST NOT flash blank or fall back to an empty-thread state

#### Scenario: deferred image behavior stays Claude-scoped
- **WHEN** the deferred media descriptor comes from Claude history restore
- **THEN** the curtain MAY use Claude-specific load actions and diagnostics
- **AND** Codex, Gemini, and OpenCode image/render contracts MUST remain unchanged unless they explicitly opt into the same deferred media contract

### Requirement: Live Rendering MUST Preserve Long Assistant Paragraph Structure

Live rendering MUST preserve paragraph and newline structure for long assistant text while allowing bounded processing-stage fallback rendering.

#### Scenario: long live text keeps paragraph breaks
- **WHEN** an active assistant message streams long CJK or Markdown text with paragraph breaks
- **THEN** the live conversation surface MUST preserve visible paragraph separation
- **AND** it MUST NOT collapse the text into a single dense paragraph solely because the message exceeded ordinary live-render size

#### Scenario: processing fallback converges to final Markdown
- **WHEN** a long assistant message used plain, lightweight, chunked, or throttled rendering while processing
- **AND** the turn completes with final assistant text
- **THEN** the rendered surface MUST converge to final Markdown semantics
- **AND** headings, paragraphs, lists, code fences, links, and emphasis MUST NOT require thread switching or history replay to recover

#### Scenario: display truncation does not contaminate canonical render source
- **WHEN** the renderer uses a shortened preview, summary, or degraded display for a long assistant message
- **THEN** that display text MUST remain separate from the canonical message text used for later deltas and final rendering
- **AND** the shortened display text MUST NOT become the source of truth for the active assistant body

### Requirement: Assistant Message Tail Actions MUST Expose Copy And Latest Branch Actions

Completed assistant replies MUST expose compact tail actions that reuse existing message/session behavior without changing conversation content.

#### Scenario: assistant replies show copy actions

- **WHEN** the conversation timeline renders an assistant message
- **THEN** the message tail MUST expose a copy icon action
- **AND** copy MUST copy the rendered assistant text when a rendered value is available

#### Scenario: latest final assistant reply shows fork action

- **WHEN** an assistant message is the latest final assistant reply in the active thread
- **AND** it has a valid previous user-message anchor
- **THEN** the message tail MUST expose a fork icon action
- **AND** fork MUST open a shared confirmation dialog explaining the fork purpose and usage
- **AND** fork MUST route through the existing composer fork flow only after the user confirms

#### Scenario: latest final assistant reply shows rewind action

- **WHEN** an assistant message is the latest final assistant reply in the active thread
- **AND** it has a valid previous user-message anchor
- **THEN** the message tail MUST expose a rewind icon action
- **AND** rewind MUST open the existing rewind confirmation dialog using that previous user-message anchor
- **AND** rewind MUST execute only after the user confirms the dialog

#### Scenario: older assistant replies do not show fork or rewind

- **WHEN** an assistant message is not the latest final assistant reply
- **THEN** the message tail MUST NOT expose the fork icon
- **AND** the message tail MUST NOT expose the rewind icon
- **AND** copy availability MUST remain independent of the latest-final visibility rule

#### Scenario: unsupported action anchors are hidden

- **WHEN** an assistant message cannot be mapped to a previous user-message anchor
- **THEN** fork and rewind actions MUST be hidden for that message
- **AND** the copy action MUST remain available when the message has copyable text

### Requirement: Message Render Helper State MUST Be Idempotent

Conversation message rendering MUST avoid committing semantically unchanged helper state from effects, layout effects, timers, or RAF callbacks, especially for `Set` / `Map` / array-backed UI state used by expansion, anchors, and streaming presentation helpers.

#### Scenario: repeated streaming render does not exceed React update depth

- **WHEN** an active conversation rerenders repeatedly with the same workspace, thread, live reasoning ids, and visible message semantics
- **THEN** the message render surface MUST NOT submit a new helper state object solely because an input array or derived collection received a new reference
- **AND** React MUST NOT reach `Maximum update depth exceeded`

#### Scenario: changed helper state still commits

- **WHEN** a genuinely new reasoning, explore, anchor, or message id changes the intended helper state
- **THEN** the message render surface MUST commit the new helper state
- **AND** existing live row visibility and latest reasoning auto-expand behavior MUST remain intact

### Requirement: Live assistant text MAY bypass root reducer while preserving final transcript convergence

During an active streaming turn, the message surface MUST support visible assistant body growth through a transient live-text channel instead of requiring every text delta to mutate the root conversation item array.

#### Scenario: live text grows when item identity remains stable

- **WHEN** an assistant message is streaming
- **AND** new body text arrives through the live assistant text channel
- **AND** the durable conversation item array identity does not change for that delta
- **THEN** the visible assistant row MUST still be able to show the new text
- **AND** the message surface MUST NOT depend solely on parent array identity or `scrollKey` changes as proof of live text growth

#### Scenario: completion converges to durable transcript state

- **WHEN** a streaming assistant message completes after using transient live text
- **THEN** the durable reducer/history settlement path MUST converge to the final assistant body
- **AND** the final transcript MUST NOT depend on the transient live channel remaining populated

#### Scenario: live text is scoped to the current assistant item

- **WHEN** multiple threads or assistant items are active or restored
- **THEN** live text channel subscriptions MUST be scoped by thread/item identity
- **AND** text published for one assistant item MUST NOT appear in another thread or item

### Requirement: Live bottom-follow MUST react to rendered content growth

When live assistant text is delivered through a path that does not mutate the root conversation item array for every delta, the message surface MUST keep bottom-follow behavior tied to actual rendered content growth. History-open, live growth, turn-settle, timeline remeasure, auto-follow re-enable, and explicit bottom navigation MUST preserve their existing trigger semantics while delegating bottom movement to one shared convergence owner.

#### Scenario: streaming height growth keeps viewport pinned during follow window

- **WHEN** a conversation is actively streaming
- **AND** the message timeline's rendered height grows
- **AND** bottom-follow is currently allowed by the streaming follow window
- **THEN** the viewport MUST remain at the true bottom of the scroll container
- **AND** the behavior MUST NOT depend solely on reducer item identity or `scrollKey` changes

#### Scenario: direct bottom scroll includes container padding

- **WHEN** the user or live follow behavior scrolls to the latest output
- **THEN** the scroll target MUST be the scroll container's true bottom
- **AND** bottom padding MUST NOT remain below the viewport solely because a bottom sentinel used `scrollIntoView`

#### Scenario: post-write virtualizer correction is reconverged

- **WHEN** a bottom trigger writes the current true-bottom target
- **AND** virtual row measurement or content layout subsequently changes `scrollHeight` or corrects `scrollTop`
- **THEN** the active bottom operation MUST recompute the target on later animation frames
- **AND** it MUST complete only after the viewport remains at true bottom for consecutive stable frames or a bounded safety budget is exhausted

#### Scenario: existing bottom trigger points share one owner

- **WHEN** history-open, live growth, turn-settle, timeline scope reset, auto-follow re-enable, or the floating bottom control requests bottom movement
- **THEN** each trigger MUST delegate to the same active scroll convergence owner
- **AND** a newer request MUST cancel or replace an older active convergence run instead of creating competing writers

#### Scenario: deliberate scroll-away releases bottom-follow

- **WHEN** the user intentionally scrolls upward during a live conversation
- **THEN** automatic bottom-follow MUST pause
- **AND** any active automatic bottom convergence MUST be cancelled
- **AND** later rendered height growth MUST NOT force the viewport back to bottom until a follow window or explicit user action allows it

#### Scenario: explicit top and bottom navigation retain their positions

- **WHEN** the user activates the existing floating top or bottom control
- **THEN** the control MUST retain its current direction, visibility, visual, and accessibility semantics
- **AND** top navigation MUST converge to zero while bottom navigation MUST converge to the current true bottom through the shared owner

#### Scenario: history initialization is independent from focus follow

- **WHEN** an idle history conversation opens and its virtualized or deferred rows finish measuring after the first paint
- **THEN** the viewport MUST recheck and converge to the true bottom during a bounded initialization window
- **AND** disabling live focus follow MUST NOT disable this one-time history placement

#### Scenario: focus follow governs live and settle rechecks

- **WHEN** live output grows or a completed turn back-fills the full timeline
- **THEN** delayed bottom rechecks MUST run only while focus follow is enabled and the user remains parked at the bottom
- **AND** disabling focus follow or deliberately scrolling away MUST cancel active and pending automatic follow work

#### Scenario: explicit navigation does not mutate focus follow preference

- **WHEN** the user activates the floating bottom control while focus follow is disabled
- **THEN** the viewport MUST navigate to the true bottom once
- **AND** the persisted focus follow preference MUST remain disabled

#### Scenario: stable edge checks do not emit redundant scroll writes

- **WHEN** a convergence pulse or delayed checkpoint finds the viewport already within tolerance of its target
- **THEN** it MUST count the frame as stable without assigning `scrollTop` again
- **AND** duplicate requests for the same active intent MUST NOT restart its checkpoint sequence

#### Scenario: active conversation history initializes before settlement

- **WHEN** history content first becomes available while the conversation is already working or thinking
- **THEN** the viewport MUST perform and record its one-time history placement immediately
- **AND** a later turn settlement MUST NOT be mistaken for missing history initialization
- **AND** a user scroll-away after initial placement MUST remain authoritative through settlement

#### Scenario: automatic bottom intents receive a two-second final calibration

- **WHEN** history-open, live-follow, turn-settle, or focus-follow re-enable requests bottom convergence
- **THEN** the owner MUST retain immediate feedback and the existing early checkpoints
- **AND** it MUST re-evaluate the current true bottom at 2000ms within a lifecycle budget that tolerates timer jitter
- **AND** thread switch, manual scroll-away, top navigation, or focus-follow disable MUST cancel the pending final calibration where applicable

#### Scenario: closing and reopening the same cached thread restarts history placement

- **WHEN** the persistent message surface transitions from thread A to no active thread and later back to thread A
- **THEN** the reopened thread MUST be treated as a new history-placement lifecycle
- **AND** cached history that is already available without a loading phase MUST still converge to the true bottom
- **AND** oversized or lightweight timeline presentation MUST NOT bypass this placement

#### Scenario: every followed turn settles before back-fill can release the intent

- **WHEN** a followed conversation completes any later turn and the full timeline back-fills
- **THEN** turn-settle convergence MUST be armed during the layout phase before asynchronous geometry scroll signals
- **AND** repeated turns MUST each receive the same settle convergence sequence
- **AND** deliberate user scroll-away or disabled focus follow MUST remain authoritative

### Requirement: Live auto-follow re-enable MUST re-arm the current viewport

When the user re-enables live auto-follow during an active message canvas run, the system MUST treat that action as an explicit request to return the current message viewport to the latest output and resume bottom-follow.

#### Scenario: re-enable focus follow returns to latest output
- **WHEN** a live conversation is processing
- **AND** the user has scrolled away from the bottom so automatic following is paused
- **AND** the user re-enables the focus-follow live canvas control
- **THEN** the message viewport MUST scroll to the bottom sentinel
- **AND** later live output MUST be allowed to continue bottom-following

#### Scenario: manual scroll pause remains respected until explicit re-enable
- **WHEN** a live conversation is processing
- **AND** the user scrolls away from the bottom
- **THEN** automatic bottom-follow MUST pause
- **AND** the viewport MUST NOT be forced back to the bottom unless the user returns to the bottom or explicitly re-enables focus follow

#### Scenario: static history updates do not become live auto-follow
- **WHEN** no conversation turn is actively processing or finalizing
- **AND** static history rows change
- **THEN** the focus-follow control MUST NOT cause an unrelated automatic scroll to the bottom

### Requirement: Programmatic bottom-follow MUST converge without anchor state feedback

当 `Messages` 通过 bottom-follow 将 active conversation viewport 保持在 true bottom 时，系统 MUST 使用不依赖 virtualized row 瞬时 geometry 的稳定 active message anchor，并且 MUST NOT 因 programmatic scroll、content resize 与 anchor state render 互相反馈而形成 React update loop。该稳定策略 MUST 保留现有 message anchor rail、scroll control 与 timeline 的可见行为。

#### Scenario: Repeated bottom-follow resize keeps the latest anchor stable

- **WHEN** streaming 或迟到的 virtual row measurement 重复改变 timeline 高度，且 viewport 仍处于 bottom-follow 的 near-bottom 区域
- **THEN** active message anchor MUST 稳定指向 latest user message anchor
- **AND** repeated programmatic scroll events MUST NOT 持续提交新的 anchor React state
- **AND** viewport MUST 继续保持在 true bottom

#### Scenario: User scroll-away retains viewport anchor tracking

- **WHEN** 用户主动向上滚动并离开 near-bottom 区域
- **THEN** bottom-follow MUST 按现有语义解除
- **AND** active message anchor MUST 继续根据当前 viewport 中的 message position 更新
- **AND** anchor rail 的外观、可见性与点击跳转行为 MUST 保持不变

### Requirement: Restored Heavy Conversation Surfaces MUST Stay Readable And Locally Recoverable

Restored conversation surfaces with heavy history content MUST keep a readable conversation surface and MUST contain row-level render failures inside the conversation area.

#### Scenario: heavy restored history does not blank or overlap the conversation
- **WHEN** a restored conversation contains long Markdown, tables, tool cards, batch file-read cards, diffs, anchors, or popovers
- **THEN** the conversation surface MUST keep visible readable rows
- **AND** the surface MUST NOT collapse to an empty-thread placeholder, full blank area, or incoherent row overlap solely because heavy rows are present

#### Scenario: row render failure stays local to the row
- **WHEN** one conversation row, Markdown island, tool-card detail, or diff detail throws during render
- **THEN** the conversation surface MUST render a local recoverable fallback for the failing row or island
- **AND** the failure MUST NOT force the entire app into the global `Application Error` page when the rest of the shell can continue

#### Scenario: anchor target gets hydration priority
- **WHEN** the user jumps to a message anchor whose row is virtualized, summarized, or not yet hydrated
- **THEN** the target row MUST receive hydration priority
- **AND** the anchor-ready signal MUST wait for a readable target surface rather than resolving against a missing or placeholder-only DOM node

### Requirement: Heavy Conversations MUST Offer A Lightweight Mode And Oversized-History Recovery Path

The conversation surface MUST provide an explicit lightweight render policy for heavy histories and MUST avoid freezing or crashing when a history is too large or complex for immediate full-detail hydration.

#### Scenario: lightweight mode keeps canonical actions
- **WHEN** a heavy conversation opens in lightweight mode or the user enables lightweight mode for the selected conversation
- **THEN** tool cards, batch read cards, diffs, and heavy Markdown islands MAY render summaries or placeholders by default
- **AND** copy, export, open-file, open-diff, fork, rewind, and anchor actions MUST continue to read canonical conversation data where those actions are available

#### Scenario: severe history opens with a degraded prompt
- **WHEN** row count, payload size, and render weight exceed the documented severe-history threshold
- **THEN** the conversation surface MUST show a bounded prompt, banner, or degraded surface with choices to stay lightweight, hydrate visible details, or retry full detail
- **AND** navigation, Composer input, and safe row summaries MUST remain usable while the prompt is displayed

#### Scenario: normal conversations keep full fidelity
- **WHEN** a conversation is below the documented heavy-history thresholds
- **THEN** the renderer SHOULD keep the normal eager-rich behavior where current budgets allow
- **AND** lightweight-mode summaries MUST NOT become the global default for ordinary histories

### Requirement: Conversation Presentation Scopes MUST Separate History And Realtime Windows

The conversation surface MUST scope deferred snapshots, virtualizer measurement caches, and timeline recovery keys by the active presentation window semantics, not only by conversation identity.

#### Scenario: collapsed and expanded history windows do not reuse stale presentation state
- **WHEN** the same `workspaceId + threadId` switches from a collapsed tail window to a manually expanded history window
- **THEN** the presentation scope MUST change
- **AND** deferred timeline snapshots, row measurement caches, and lightweight hydration retention MUST NOT treat the collapsed tail layout as valid for the expanded history layout

#### Scenario: jump-expanded history has a distinct scroll owner
- **WHEN** a jump-to-message action expands earlier history to reveal an offscreen target
- **THEN** the presentation scope MUST distinguish jump expansion from manual expansion
- **AND** anchor target readiness MUST be driven by the jump target rather than by bottom auto-follow or manual history-head reset

#### Scenario: realtime live tails stay separate from static history restore
- **WHEN** a conversation is actively streaming
- **AND** the renderer is showing a full or collapsed live tail window
- **THEN** the presentation scope MUST be distinct from static restored-history scopes for the same conversation
- **AND** live auto-follow MUST NOT reuse stale full-history or expanded-history measurement state that can cause row overlap or up/down scroll tug-of-war

#### Scenario: completed realtime tail restores full history at the latest message
- **WHEN** a long conversation is actively streaming through a bounded live tail window
- **AND** the turn completes and the renderer restores the full static history for the same `workspaceId + threadId`
- **THEN** the initial bottom-pin scope MUST NOT have been consumed by the earlier working/thinking render
- **AND** the restored static history MUST land at the latest message unless an explicit jump-to-message action owns the scroll position

### Requirement: History Reopen MUST Not Convert Degraded Empty Evidence Into Authoritative Empty

History hydration and reopen MUST distinguish a proven empty conversation from a degraded or failed empty response.

#### Scenario: optimistic pending thread is selected

- **WHEN** a local optimistic thread id matches the `codex-pending-*` contract
- **THEN** resume MUST preserve the local thread surface and mark the local draft loaded
- **AND** it MUST NOT invoke a backend history loader
- **AND** it MUST NOT record `history-hydrate-empty`.

#### Scenario: last-good transcript exists and reopen returns degraded empty

- **WHEN** a conversation has a last-good readable transcript
- **AND** local hydration, snapshot hydration, or runtime reopen temporarily returns empty or fails
- **THEN** the client MUST preserve the last-good readable transcript
- **AND** it MUST record a bounded recovery outcome instead of replacing the surface with an empty-thread placeholder.

#### Scenario: bounded recovery also fails

- **WHEN** the client performs its one allowed automatic reopen or refresh recovery
- **AND** no readable transcript or authoritative empty proof is produced
- **THEN** the client MUST stop automatic retries
- **AND** it MUST expose a degraded/failed history state with a stable reason code.
- **AND** it MUST NOT mark the failed recovery as successfully restored or loaded.

#### Scenario: failed thread is selected again without explicit retry

- **WHEN** one canonical thread has consumed its automatic recovery and remains degraded or failed
- **AND** the user switches away and later selects that thread again, or another caller directly resumes the same canonical thread
- **THEN** every alias and caller MUST preserve the failed readable surface without another automatic loader call
- **AND** only an explicit user Retry action MAY re-arm one bounded recovery attempt.

#### Scenario: an older history request settles after a newer request

- **WHEN** overlapping requests exist for the same canonical thread
- **AND** the older generation completes after a newer generation has already published readable or failed state
- **THEN** the older generation MUST NOT write loaded/failed flags, replace items, switch aliases, or hydrate queues
- **AND** the newest generation MUST remain the sole state owner.

#### Scenario: legacy fallback or replacement candidate is also empty

- **WHEN** the primary loader fails and a legacy fallback still produces no readable items
- **OR** stale-thread recovery selects a replacement candidate whose bounded hydration also remains empty
- **THEN** the client MUST keep the source conversation active and preserve its last-good surface
- **AND** it MUST NOT write `restoredAt`, persist an alias, clear the source queue, or switch the active thread to the empty candidate.

#### Scenario: backend proves conversation is empty

- **WHEN** an authoritative history source confirms the conversation contains no readable items
- **THEN** the client MAY render the normal empty-thread state
- **AND** last-good degraded fallback MUST NOT fabricate deleted content as current truth.

### Requirement: Growing Assistant Snapshots MUST Preserve Live-Text Render Isolation

Active non-terminal assistant item 的纯正文增长 snapshot MUST 复用 transient live-text channel，不得仅因正文增长持续改写 root conversation item array。

#### Scenario: Active assistant snapshot only grows body text

- **WHEN** 同一个 active assistant item 收到 non-terminal snapshot
- **AND** snapshot 变化仅为正文单调增长
- **THEN** 最新正文 MUST 通过 live assistant text channel 对 active row 可见
- **AND** stable Timeline presentation input MUST NOT 因该纯正文增长被替换

#### Scenario: Snapshot changes durable structure

- **WHEN** assistant snapshot 改变 item identity、结构 metadata、tool boundary、reasoning boundary 或其他 durable semantics
- **THEN** 该变化 MUST 进入 durable conversation state
- **AND** transient text optimization MUST NOT 丢弃或重排结构事件

#### Scenario: Streaming item completes

- **WHEN** 使用 transient channel 的 assistant item 收到 terminal 或 final snapshot
- **THEN** durable transcript MUST 收敛到完整最终正文
- **AND** final Markdown、history restore 与 thread switching MUST 无需依赖 transient channel
