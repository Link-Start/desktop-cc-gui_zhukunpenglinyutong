# 收紧 Linux 百度统计 Cookie 并发与提交时序

## Goal

在不关闭或削弱百度统计的前提下，修复 `fix-linux-startup-preserve-baidu-analytics` 严格审核发现的两个 backend correctness 问题。

## Requirements

- `visitor_cookie` mutex 只保护内存 snapshot / compare-and-update，不覆盖最长 15 秒的 HTTP request。
- response `Set-Cookie` 只有在对应 script 或 beacon 的全部 response validation 成功后才允许提交。
- 并发的 stale response 不得覆盖已经由较新响应更新的 visitor identity。
- accepted in-memory update 与 atomic persistence 保持一致的提交顺序。
- 只修改 Rust backend、focused tests 和对应 OpenSpec/Trellis contract；不改 marker、logger、expiry 或 frontend routing。

## Acceptance Criteria

- [x] 网络 I/O 位于 `visitor_cookie` mutex 之外。
- [x] script 的非 2xx、oversize、body read、UTF-8、marker/site id 失败均不提交 candidate Cookie。
- [x] beacon 非 2xx 不提交 candidate Cookie。
- [x] stale response 不覆盖 newer Cookie；有效 response 能更新并持久化；无 candidate 时保持不变。
- [x] `baidu_tongji::tests`、targeted `rustfmt`、`git diff --check` 与 strict OpenSpec validation 通过。

## Technical Notes

- 关联 OpenSpec change：`fix-linux-startup-preserve-baidu-analytics`。
- request 在短锁内 clone Cookie snapshot；response 完整验证后以 snapshot 作 compare-and-update。
- persistence ordering 使用独立短持久化串行化机制或等价 generation 机制，避免并发磁盘写反序覆盖。
