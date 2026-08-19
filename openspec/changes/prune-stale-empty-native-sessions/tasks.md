## 1. Classifier and disk confirmation

- [x] 1.1 新增 `session_index/empty_prune.rs`：占位标题、10 分钟年龄锚点（`created_at` 优先）、扫描/删除上限常量
- [x] 1.2 Claude：`physical_path` 或 reconstructed project jsonl 上无真实 user 文本才确认空；无参数 slash command / local-command / caveat / 注入信封（system-reminder、user_info 等）不算真实提问
- [x] 1.3 Grok：O(1) encoded-cwd 命中后 peek `chat_history.jsonl`；未命中再 bounded 扫描 `sessions/*/<id>/`；仍找不到则跳过；确认路径写回 target
- [x] 1.4 PI：定位 `*_{sessionId}.jsonl` 后 peek user message；找不到文件则跳过；确认路径写回 target
- [x] 1.5 DSH：占位 + 过期后 `connect_existing`（2s）+ 并行 peek（总预算 3s）；无真实 user 且 `hasMore=false` 才 archive；复用同一次 client；host 未挂跳过
- [x] 1.6 Codex / Gemini / Kimi 仅在有 `physical_path` 且 0 字节/缺失时确认；OpenCode / Shared 跳过

## 2. Delete + tombstone hook

- [x] 2.1 确认空后调用既有 `delete_claude_session` / `delete_grok_session` / `delete_pi_session` / `archive_dsh_session`；引擎 not-found 时回退删除确认路径
- [x] 2.2 删除成功或文件已不存在才 `tombstone_session_ids(["engine:id"])`；失败不打 tombstone
- [x] 2.3 在 `list_session_index_for_workspace` 首页（非 keyset）sync 之后、SQL list 之前调用 prune；错误只记日志

## 3. Tests

- [x] 3.1 占位标题 / UUID==session_id / 自定义标题分类测试
- [x] 3.2 年龄：未满 10 分钟保留；`created_at` 优先于被刷新的 `updated_at`
- [x] 3.3 Claude / Grok / PI 空盘删除 + tombstone；有真实 user prompt 不删
- [x] 3.4 Grok 目录找不到不 tombstone；PI 文件找不到不 tombstone；DSH 无 host 不猜删；keyset 路径不跑 prune
- [x] 3.5 Claude command-only 可删；带 `<command-args>` 的斜杠命令保留；DSH 占位只进 host confirm 队列
- [x] 3.6 Claude 仅注入信封（system-reminder / user_info）可删；信封后仍有正文保留；Grok/PI 确认路径写入 target

## 4. Verify

- [x] 4.1 `cargo test --manifest-path src-tauri/Cargo.toml --lib empty_prune`
- [x] 4.2 `openspec validate prune-stale-empty-native-sessions --strict --no-interactive`
- [ ] 4.3 交用户目视：重建 Rust 后打开 workspace，过夜空会话与本地稿是否消失

## 5. Review hardening

- [x] 5.1 标题分类覆盖 writer 真值：`PI session {8hex}` / `Warmup` / `Agent N` / control-plane tag
- [x] 5.2 confirm 改为三态；Claude 缺文件、Grok 无 `chat_history`、metadata 失败一律 Unknown
- [x] 5.3 `created_at` sticky；DSH 用 host `createdAt`（缺省才回退 `updatedAt`）
- [x] 5.4 删除前 `still_empty_before_delete`；`tombstone_engine_sessions`；无确认路径不 tombstone；0 字节文件长大则拒绝删
- [x] 5.5 前端 `isWeakSessionDisplayTitle` 对齐 `PI session {hex}` / `Warmup`
- [x] 5.6 `{engine}-pending-{millis}-{nonce}` 视为已确认空草稿：只 tombstone、不走 locator/host；Shared/subagent pending 仍跳过
- [x] 5.7 last-good / missing-engine merge 不得把已 tombstone 的本地稿补回侧栏；真会话 last-good 仍保留
- [x] 5.8 侧栏投影立即隐藏 `{engine} session` / `DeepSeek Harness Session` 占位草稿（含 DSH/Grok/Gemini/Kimi/PI）；pending / 自定义标题 / 真实提问仍可见；不改 prune
