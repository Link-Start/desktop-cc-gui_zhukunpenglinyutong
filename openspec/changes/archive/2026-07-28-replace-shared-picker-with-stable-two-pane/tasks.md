## 1. Regression Contract

- [x] 1.1 [P0, depends: none] 增加 Shared single-root/two-pane 结构测试，证明 nested submenu 不再存在。
- [x] 1.2 [P0, depends: 1.1] 覆盖 CLI 切换、Provider A/B 重复互斥折叠与 Model terminal selection。

## 2. Implementation

- [x] 2.1 [P0, depends: 1.2] 将 Shared `targetGroups` 改为单一 root 双栏布局。
- [x] 2.2 [P0, depends: 2.1] 保留 Native 与 legacy `modelGroups` 行为。

## 3. Verification

- [x] 3.1 [P0, depends: 2.2] 运行 focused tests、typecheck、lint、runtime contracts 与 strict OpenSpec validation。
- [x] 3.2 [P0, depends: 3.1] 用户在 Shared Session 实机验证 accordion 展开折叠与双栏交互。
- [x] 3.3 [P1, depends: 3.2] 记录 verification evidence，同步 main spec 并归档 OpenSpec/Trellis。
