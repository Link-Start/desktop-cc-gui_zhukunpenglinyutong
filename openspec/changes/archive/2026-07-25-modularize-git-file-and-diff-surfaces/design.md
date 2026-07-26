## Context

当前问题包含三种耦合：组件内 capability 集中、测试 suite 集中、相邻 surface contract 平行演化。只移动 JSX 无法降低变更耦合，必须让抽出的 module 拥有明确输入、输出与 focused tests。

## Goals / Non-Goals

**Goals:**

- production/test 同步按 capability 切片。
- AI commit generation 只保留一个 orchestration contract。
- diff core data normalization 只保留一个 presentation model。

**Non-Goals:**

- 不创建万能 panel abstraction。
- 不合并 editable 与 read-only policy。

## Decisions

1. AI commit controller 采用纯 async orchestration，UI 只管理 menu/state。
2. File View 优先抽已有完整 capability，避免跨多个 effect 人工切割。
3. diff presentation model 只规范 path/status/diff/media metadata，不接管 toolbar、annotation 或 editing state。
4. tests 按现有 top-level `describe` 拆文件；共享 setup 进入现有 test utils。

## Risks / Trade-offs

- [Risk] test mock hoisting 在拆文件后变化 → 每个新 suite 独立声明 mock，并运行 focused tests。
- [Risk] controller 统一后 repository scope 丢失 → contract 显式接收 selections/paths。
- [Risk] presentation model 过度抽象 → 只抽共同数据，不抽 policy。

## Migration Plan

1. 抽 shared contracts/controller。
2. 迁移两个 production caller。
3. 拆 production capability 与 tests。
4. 运行 targeted gate、tests、typecheck、lint。

## Open Questions

无。仓库其余 13 项 large-file failures 保持现状并在报告中单列。
