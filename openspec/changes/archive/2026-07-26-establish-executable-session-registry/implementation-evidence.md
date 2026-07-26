# Implementation Evidence

## Ownership inventory 与 schema

- Existing `RuntimeManager` 继续拥有 process handle、PID、replacement gate
  与 runtime generation；未新增第二套 process manager。
- 新 `ExecutableSessionRegistry` 只持有 plain data：logical session、
  engine、adapter、native binding、generation、state、cursor、
  last settled run 与 settlement idempotency set。
- Codex persistent runtime、replacement、Claude discovered runtime 接入同一
  registry；Codex terminal event 以 thread identity 建立 logical session
  binding。

## Control、recovery 与 compaction

- register / rebind / resolve / transition / release 均执行 generation guard；
  replacement 后旧 generation 无法继续控制 session。
- 独立 Tokio `control_lane` 串行化 control mutation。terminal event handler
  只 `tokio::spawn` enqueue settlement work 后返回，不在 callback stack
  同步等待同 lane。
- registry 使用 atomic JSON durable record、monotonic cursor 与 transition
  evidence。restart 将 interrupted acquiring / active / stopping 收敛为
  recoverable。
- transition 超阈值后 checkpoint compaction；entry cursor 与
  `settledRunIds` 保留，因此 replay 前后 idempotency 一致。
- 所有 registry mutation error 显式写 warning，不静默吞错。

## Frontend projection

- `createExecutableSessionProjectionSelector` 只投影 session identity、
  generation、lifecycle 与 native binding。
- streaming lease、last-used 和 delta-only 变化保持 projection reference
  稳定，不把高频消息活动挂入 AppShell root。

## Verification

- focused Rust: stale generation、serial control、crash recovery、compaction
  idempotency、terminal event async settlement。
- focused Vitest: projection reference stability 与 delivery queue。
- daemon compile、TypeScript compile、strict OpenSpec validation。
