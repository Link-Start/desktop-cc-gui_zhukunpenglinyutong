## 1. History 解析（Rust）

- [x] 1.1 `grok_history.rs`：flat + nested name/arguments；双缺才 `tool`
- [x] 1.2 tests：flat 多工具 + result pairing
- [x] 1.3 tests：nested 回归；缺 name fallback

## 2. 分类（FE 最小）

- [x] 2.1 `toolSemantics`：`list_dir`→read、`search_replace`→edit、`run_terminal_command`→bash
- [x] 2.2 groupToolItems / parser 测试：连续 Grok 名 → read/search/bash/edit group；todo hide

## 3. 验证

- [x] 3.1 cargo test --lib（flat / nested / fallback）
- [x] 3.2 focused Vitest（toolSemantics / groupToolItems / grokHistoryParser）24 passed
- [x] 3.3 `pnpm exec tsc --noEmit` 通过
- [x] 3.4 `openspec validate fix-grok-history-tool-projection --strict`
- [ ] 3.5 手工：重载真实 Grok 历史会话，确认无「一排 Tool」

## 4. 收尾

- [ ] 4.1 verify / 按需 sync / archive（用户确认后）
