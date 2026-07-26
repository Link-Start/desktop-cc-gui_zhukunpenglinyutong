## Context

该 change 依赖前序 capability、registry、catalog、lifecycle contract。目标是 ownership migration，不是按行数机械切文件。

## Goals / Non-Goals

**Goals:** 窄 facade、单 owner、typed boundary、root render isolation。

**Non-Goals:** 不改变 engine/model UX，不承担前序 foundation 实现。

## Decisions

1. facade 只组合 selection、availability、catalog、notices 的低频 snapshot/actions。
2. 每个 domain owner 先有 parity tests，再从 controller 删除旧逻辑。
3. event bus/message arrays 不进入 facade；canvas 通过现有 external channel/store。
4. AppShell public shape 分阶段兼容，最终删除未使用 fields。

## Risks / Trade-offs

- [effect 顺序改变] → characterization tests 锁定 startup/switch/refresh/storage sequences。
- [双 owner] → migration 阶段 shadow compare，禁止长期 dual write。
- [仅移动代码未降熵] → large-file gate 加 owner duplication scanner。

## Migration Plan

按 availability、selection、catalog、notices 顺序迁移；每批验证后删除旧 owner。feature-level revert 不需要回滚 foundation contract。

## Open Questions

最终 facade 是否保留为 public hook，依据迁移后调用方数量决定。
