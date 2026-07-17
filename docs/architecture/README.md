# Architecture 文档索引

本目录记录架构策略、治理规则与 large-file 基线。基线类文档反映生成时的仓库状态；当前代码事实仍需回到 [`../../README.md`](../../README.md)、[`../../AGENTS.md`](../../AGENTS.md) 与 [OpenSpec 当前状态](../../openspec/project.md) 核验。

## 架构与治理

- [Harness Governance Layer — mossx 战略架构文档](harness-governance-strategy.md)
- [Large File Governance Playbook](large-file-governance-playbook.md)

## Large-file 基线

- [Large File Hard-Debt Baseline](large-file-baseline.md)
- [Large File New-File Ratchet Baseline](large-file-new-file-baseline.md)
- [Large File Near-Threshold Watchlist](large-file-near-threshold-watchlist.md)

其中 baseline / watchlist 是采样快照，不代表当前文件行数；执行 gate 时以仓库现有脚本与当前扫描结果为准。
