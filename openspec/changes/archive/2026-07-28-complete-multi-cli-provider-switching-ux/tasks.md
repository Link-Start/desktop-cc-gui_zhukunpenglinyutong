## 1. Provider-aware Target Picker

- [x] 1.1 [P0, depends: none] 以现有 Provider registry 与 model catalog 为输入，定义无 model-id 反推的完整 target identity/projection helper；输出 unit tests 覆盖同名 model、local profile 与 unavailable reason。
- [x] 1.2 [P0, depends: 1.1] 将 Shared Session composer 接到 `CLI → Provider Profile → Model → Reasoning` 选择链路；输出原子 `selectedNextTarget`，验证 picker lock 与无 side effect。
- [x] 1.3 [P0, depends: 1.2] 在 A–D picker 中显示 Kimi 及禁用原因；复用 Radix 键盘/focus 语义，并验证 disabled、aria label 与窄宽度截断。

## 2. Native Provider Continuation UX

- [x] 2.1 [P0, depends: 1.1] 将 context-menu 的 continuation request 与 side effect 分离，输出可渲染 preview state。
- [x] 2.2 [P0, depends: 2.1] 新增产品内 Provider Continuation Dialog，展示 source/target/mode/omissions/token estimate/capability state；删除相关 Tauri native `ask/confirm`。
- [x] 2.3 [P0, depends: 2.2] 显示 Kimi source-only target boundary；执行成功、失败、recovery-required 均在产品 UI 内结算。

## 3. Continuation Identity And Projection

- [x] 3.1 [P0, depends: none] 新增严格 control protocol classifier；只识别完整 `MOSSX_NATIVE_CONTEXT_V1`、Context Package 与 ACK grammar，测试普通 MOSSX 文本不被吞。
- [x] 3.2 [P0, depends: 3.1] 普通 transcript/title projection 跳过 control entries，输出可读 continuation title。
- [x] 3.3 [P0, depends: 3.2] Canvas 新增 continuation context card，显示 frozen source/target，并支持来源导航与缺失状态；mode/fidelity/recovery 只在有真实 operation result 的 Dialog 展示。
- [x] 3.4 [P1, depends: 3.3] 校准 sidebar continuation badge、provider label 与 tooltip，移除 raw hash/default 技术文案。

## 4. Quality And Cross-platform Review

- [x] 4.1 [P0, depends: 1.3,2.3,3.4] Review macOS/Windows/Linux 行为：禁止平台路径拼接、shell 依赖与 native dialog；补纯逻辑/组件自动化测试。
- [x] 4.2 [P0, depends: 4.1] Review render path：不在 AppShell 根链预加载全部 catalog、不新增秒级轮询或逐事件 root setState；保留 last-good/stale 状态。
- [x] 4.3 [P0, depends: 4.2] 运行相关 Vitest、Rust tests、typecheck、scoped lint 与 `openspec validate complete-multi-cli-provider-switching-ux --strict --no-interactive`。

## 5. Documentation And Closure

- [x] 5.1 [P0, depends: 4.3] 更新 A–D 总任务清单、影响/人工测试计划与 onboarding guide，明确 UI 入口、Kimi 边界与 continuation card。
- [x] 5.2 [P0, depends: 5.1] 生成 verification evidence，执行 OpenSpec verify/sync/archive，并完成代码 review。
- [x] 5.3 [P0, depends: 5.2] 完成中文 Conventional Commit 与 Trellis session record 的提交前准备；实际 commit/record 按仓库 workflow invariant 紧随归档执行。
