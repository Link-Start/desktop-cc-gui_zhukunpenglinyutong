## 1. OpenSpec / 契约

- [x] 1.1 [P0] 写入 proposal / design / delta specs（shared-session-thread、shared-send-pipeline）
- [x] 1.2 [P0] `openspec validate fix-shared-hidden-binding-visibility --strict --no-interactive`

## 2. Backend identity 适配

- [x] 2.1 [P0] Grok materialize 预分配 `grok:{uuid}`；拒绝 pending 当 established
- [x] 2.2 [P0] `resolve_grok_session_id` + send：continue=false 仍可用 explicit id 走 `-s`
- [x] 2.3 [P0] Shared send 对 Grok 始终传 raw session id（对齐 Claude）
- [x] 2.4 [P0] Kimi/OpenCode：normalize 前缀 + settlement 写入 established id
- [x] 2.5 [P0] focused Rust tests：established / resolve_grok / coordinator normalize

## 3. Frontend hide + rebind

- [x] 3.1 [P0] `hiddenSharedBindingIds` 等价扩展（raw / engine:raw / pending）
- [x] 3.2 [P0] `thread/started` pending rebind 覆盖 claude/codex/kimi/grok/opencode
- [x] 3.3 [P0] `useThreadActions.shared-native-compat` 补 Grok/Kimi/OpenCode hide 用例

## 4. 验证

- [x] 4.1 [P0] focused Vitest + focused Rust tests
- [x] 4.2 [P0] `git diff --check` 通过；`tsc --noEmit` 仅见预存无关错误 `useSidebarMenus.test.tsx`
- [x] 4.3 [P0] OpenSpec strict validate；记录手测项（Shared×Grok/Kimi/OpenCode hide）
