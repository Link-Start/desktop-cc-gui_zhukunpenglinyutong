## 1. Picker Mode 与 Home Draft

- [x] 1.1 [P0，依赖：无] 输入：现有 Native/Shared picker props；输出：显式 create-session picker mode，复用双栏 catalog 且不启用 Shared persistence；验证：Adapter/InputBox focused tests。
- [x] 1.2 [P0，依赖：1.1] 输入：Home `ExecutionTarget` selection；输出：Composer 局部 creation draft、footer 选中态与 reasoning 更新；验证：Composer focused test。
- [x] 1.3 [P0，依赖：1.2] 输入：`homeComposerNode`；输出：仅首页启用 create-session mode，Conversation Composer 保持 Native/Shared 判定；验证：layout focused test 或 prop assertion。

## 2. 新会话创建链路

- [x] 2.1 [P0，依赖：1.2] 输入：完整 Home target；输出：类型安全的 creation-only send payload；验证：TypeScript typecheck。
- [x] 2.2 [P0，依赖：2.1] 输入：creation payload 与目标 workspace；输出：按 Engine/Provider 创建 thread，初始化 thread-scoped Model/Reasoning，并以 runtime Model/Reasoning 发送首 Turn；验证：orchestration focused test。
- [x] 2.3 [P1，依赖：2.2] 输入：创建后的普通发送；输出：creation-only payload 被消费且不污染后续 Native Turn；验证：focused test 断言下游 options。

## 3. 回归与规范验证

- [x] 3.1 [P0，依赖：1.*, 2.*] 运行 Native 单栏、Home 双栏、Shared 双栏以及首页创建定向 Vitest。
- [x] 3.2 [P0，依赖：3.1] 运行 `npm run typecheck` 与相关 lint/contract checks，修复本变更引入的问题。
- [x] 3.3 [P0，依赖：3.2] 运行 `openspec validate use-home-double-column-target-picker --strict --no-interactive` 并记录最终 diff 审查结果。

## 4. Provider Header 与 Claude Local Selection 回归

- [x] 4.1 [P0，依赖：1.*] 输入：Claude/Codex 双栏 Provider header；输出：稳定的 reload/discovery 双 action slot，Claude discovery 置灰且无 side effect；验证：`ModelSelect` focused test。
- [x] 4.2 [P0，依赖：4.1] 输入：Home Codex target → Claude local/disk Model selection；输出：atomic target 在受控菜单关闭前稳定提交并更新 owner；验证：selector + Composer integration regression tests。
- [x] 4.3 [P0，依赖：4.2] 运行 Home/Native/Shared picker focused tests、typecheck、targeted ESLint、OpenSpec strict validation 与 `git diff --check`。
- [x] 4.4 [P0，依赖：4.2] 输入：真实 WebKit 双栏 Claude local Model activation；输出：create-session 当前 binding 不重复 reload，pointer pre-close 与 keyboard select 更新同一 atomic owner；验证：catalog + selector focused regression tests。

## 5. Native / Atomic Catalog Owner 拆分

- [x] 5.1 [P0，依赖：4.*] 输入：现有三模式 catalog hook；输出：Native 单栏与 Atomic 双栏使用互斥 input contract 和独立 hook state，Atomic 类型层禁止 `currentModels`；验证：hook focused tests。
- [x] 5.2 [P0，依赖：5.1] 输入：Home Claude Profiles；输出：Local/managed Models 按 scoped binding 归属，managed Profile 保留 public fallback 但不吸收 Native Local settings rows；验证：错位与 fallback 回归测试。
- [x] 5.3 [P0，依赖：5.2] 输入：Atomic 双栏 CLI/Profile/Model；输出：hover/focus 不切换，primary click 可切换 CLI、折叠 Profile 并选择 Local Model；验证：selector controlled interaction test。
- [x] 5.4 [P0，依赖：5.3] 运行 Home/Native/Shared focused tests、typecheck、targeted ESLint、runtime contracts、OpenSpec strict validation 与 `git diff --check`。

## 6. Claude Local Identity 回归

- [x] 6.1 [P0，依赖：5.*] 输入：backend-returned `__local_settings_json__` Profile；输出：catalog normalization 保持 `source=disk`，Model selection 形成 canonical `providerProfileId=null + providerProfileSource=disk` target；验证：catalog owner + resolved target contract regression test。
- [x] 6.2 [P0，依赖：6.1] 运行 selector/catalog、Home/Native/Shared focused tests、typecheck、targeted ESLint、runtime contracts、OpenSpec strict validation 与 `git diff --check`。

## 7. Home Hero Engine Projection

- [x] 7.1 [P0，依赖：1.*] 输入：Home creation target Engine；输出：Composer 仅向 Home owner 投影 Engine，hero icon 与 footer CLI 同步，完整 target 保持 Composer-local；验证：Composer + layout focused integration tests。
- [x] 7.2 [P0，依赖：7.1] 运行 Home/Composer/Layout focused tests、typecheck、targeted ESLint、runtime contracts、OpenSpec strict validation 与 `git diff --check`。
