## Context

`MessageRow` 是高频 presentation boundary。Comparator 必须保持 shallow、显式，
不能在 render path 序列化整个 conversation item。Deferred image hydration 跨越
async boundary，因此 request identity 必须与当前 row 的
workspace/thread/message scope 一致。

## Decisions

1. attachment object 使用 reference equality，attachment list 逐项比较 identity。
   该策略沿用现有 item comparator，避免 render path 的 deep serialization。
2. request key 由 `workspacePath`、`threadId`、`messageId` 与全部 locator fields
   组成；每次请求记录 generation，并在 state write 前验证 scope/generation。
3. stale completion 产生的 transient object URL 立即 revoke；item/scope change
   与 unmount cleanup 释放全部 owned URLs。

## Non-Goals

- 不移动 `MessageRow`，不改变 row composition。
- 不修改 virtualization threshold、React key、Markdown 或 tool rendering。
- 不新增 dependency。

## Verification

Regression tests 必须先证明旧 comparator 与 hydration guard 出现 RED，再证明
minimal fix 后 GREEN。
