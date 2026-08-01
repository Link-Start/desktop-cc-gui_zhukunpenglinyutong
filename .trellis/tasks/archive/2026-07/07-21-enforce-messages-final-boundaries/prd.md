# Enforce messages final boundaries

## OpenSpec

- Change: `enforce-messages-final-boundaries`
- Roadmap: Phase 8.4-8.6
- Date: 2026-07-21

## Goal

偿还最后 3 条 outside -> messages private dependency debt，建立可测试的 final messages dependency graph checker，并将 gate 接入 CI，完成 roadmap 全部 Definition of Done。

## Acceptance

- inbound private import count = 0.
- outbound exact baseline 与 current graph 一致，不含已偿还 7 项。
- threads、rows、timeline pure-layer 四类规则均有 deterministic fixture tests。
- CI 执行 `npm run check:messages-boundaries`。
- Phase 8.6 commands 完整执行并记录 evidence。

## Constraints

- 不新增 dependency。
- 不改变 messages runtime、rendering、streaming、history 或 recovery behavior。
- 现有 outbound debt 只能 exact freeze，不得增加 wildcard exception。
- 当前日期固定为 2026-07-21，禁止生成未来日期 metadata。
