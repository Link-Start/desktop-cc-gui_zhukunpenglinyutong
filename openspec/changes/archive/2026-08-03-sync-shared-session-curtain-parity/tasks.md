## 1. Analysis freeze

- [x] 1.1 [P0] 对照今日 Native 幕布提交与 Shared projection 源码，固化缺口矩阵（见 proposal）
- [x] 1.2 [P0] 确认 Messages 核共通、缺口在 Shared history projector

## 2. SharedProjector final meta

- [x] 2.1 [P0] 收集 attempt 的 requested_at 与 preferred usage
- [x] 2.2 [P0] 对 final assistant message 盖章 finalDurationMs / finalInputTokens / finalOutputTokens
- [x] 2.3 [P0] 保留 metadata/usage 投影，usage precedence 测试不破

## 3. SharedProjector tool fidelity

- [x] 3.1 [P0] toolType 分类：fileChange / commandExecution / 原名
- [x] 3.2 [P0] 从 detail JSON 抽取 path → changes[]
- [x] 3.3 [P1] FE dataSource 透传 changes（若尚未透传）

## 4. Tests & verify

- [x] 4.1 [P0] Rust shared_projection 回归
- [x] 4.2 [P0] FE dataSource 回归
- [x] 4.3 [P1] 记录验证命令与结果

### 验证证据

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection -- stamps_final
cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection -- tool_exchanges_map
cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection -- provider_report_usage
cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection -- late_usage
# → pass (含 review 修复：version bump / late usage stamp / Write 不强制 fileChange)

pnpm exec vitest run src/features/messages/presentation/sharedProjection/dataSource.test.ts
# → 19 passed
```

### Review 修复（对抗式）

- [x] R1 升 `CANVAS_PROJECTION_VERSION` 3→4，强制旧 checkpoint rebuild
- [x] R2 Usage 晚到时二次盖章 final tokens（project_events 末 + project merge 后）
- [x] R3 取消 Write→fileChange 强改（水土不服 → EditToolBlock 丢路由）；仅 bash→commandExecution
- [x] R4 metadata usage 补 `cachedInputTokens` 供二次盖章
- [x] R5 process-before-prose 顺序（reasoning/tools → final Text）；version → 5
- [x] R6 放开幕布 bash/command 隐藏，过程折叠展开真实 remount shell 卡
- [x] R7 Codex fileChange `changes[]` 经 Shared ingest+投影保留；CANVAS_PROJECTION_VERSION → 6


