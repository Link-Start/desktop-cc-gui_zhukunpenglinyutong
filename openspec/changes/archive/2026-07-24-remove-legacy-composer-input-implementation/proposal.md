# Proposal: remove-legacy-composer-input-implementation

## Why

Composer 存在新旧两套输入实现：旧实现 `ComposerInput.tsx`(JCEF 迁移前遗留)已被 `ChatInputBox`/`ChatInputBoxAdapter` 完全替换(`ChatInputBoxAdapter.tsx:5` 注释自述"drop-in replacement of ComposerInput"),但旧实现与其专属子组件仍留在仓库中,无任何生产引用。死代码持续误导后来者与 AI 协作者(2026-07-24 client-aux 调研即被腐化文档误导),并增大打包体积与重构时的噪音。

## What Changes

- 删除旧输入实现 `src/features/composer/components/ComposerInput.tsx`(1634 行)及其 3 个测试文件(共 678 行)
- 删除 2 个仅被 `ComposerInput.tsx` 引用的连带孤儿(引用闭包已逐一验证):
  - `src/features/composer/components/ComposerGhostText.tsx`
  - `src/features/composer/components/ContextUsageIndicator.tsx`
- 从 `docs/architecture/large-file-new-file-baseline.json` 与 `docs/architecture/large-file-new-file-baseline.md` 同步移除 `ComposerInput.tsx` 条目，保持 machine-readable / human-readable baseline 一致
- 总计约 2,400 行纯删除,无任何生产行为变更

## 第三轮修正(本轮 review 推翻上一轮部分结论)

上一轮称 `ComposerAttachments.tsx` 与 `useComposerImageDrop.ts` 为"仅被 ComposerInput 引用的连带孤儿",本轮逐一验证发现该判断**不成立**:

- `src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx`(minified @ts-nocheck 生产文件)真实 import 了 `ComposerAttachments` 与 `useComposerImageDrop`
- SpecHub 经 `SpecHubOrchestrator.tsx` → `SpecHub.presentational.tsx` → `SpecHub.tsx` 链路进入 router(`router.test.tsx` 有路由断言),是活的生产页面
- 因此这两个文件(及 `useComposerImageDrop.test.ts`)**移出本提案删除范围,予以保留**

其余文件的零生产引用闭包本轮已全部重新验证通过(见 tasks.md 验证记录)。

## Capabilities

- **New Capabilities**: 无
- **Modified Capabilities**: 无

本变更为不可达代码的纯删除,不修改任何 capability 的 requirement 级行为;归档时使用 `--skip-specs`。

## 目标与边界

- 目标:彻底移除 JCEF 迁移遗留的旧输入实现及其专属子组件,消除双实现并存造成的误导
- 边界:仅删除经引用闭包验证零生产引用的文件;保留 `ChatInputBox`/`ChatInputBoxAdapter`/`Composer.tsx` 现行实现的所有代码路径;保留被 SpecHub 复用的 `ComposerAttachments`/`useComposerImageDrop`

## 非目标

- 不改动 `ChatInputBox` 现行输入实现的任何行为(UI、交互、快捷键、补全)
- 不处理 `useComposerAutocompleteState.ts`(`Composer.tsx:1034` 生产在用,已证伪"死代码"判断)
- 不删除 `ComposerAttachments.tsx`/`useComposerImageDrop.ts`(SpecHub 生产在用,本轮修正)
- 不处理 JCEF bridge no-op 桩(`composer/utils/bridge.ts`)及 provider 死链路(另行提案 `remove-jcef-bridge-noop-stubs`)
- 不统一三套输入历史(独立议题)
- 不删除 perf fixture 与 `scripts/perf-composer-baseline.ts`(活代码;`composerInputFixture50` 为自包含 fixture,仅命名相似,不 import `ComposerInput`)

## 技术方案对比

| 选项 | 说明 | 取舍 |
|---|---|---|
| A. 一次性删除已验证死文件 | 引用闭包已验证为零生产引用,删除后编译/测试不受影响即安全 | **采用**:证据链完整,纯减法零风险 |
| B. 先标记 deprecated 再删 | 内部应用无外部 API 消费者,deprecated 期只会延长误导窗口 | 放弃:无受益者 |
| C. 保留作"参考实现" | 与现行实现已双轨漂移,保留即腐化源 | 放弃:git 历史即为参考 |

## Impact

- **受影响文件(删除)**:`src/features/composer/components/ComposerInput.tsx`、`ComposerInput.attachments.test.tsx`、`ComposerInput.collaboration.test.tsx`、`ComposerInput.manual-memory.test.tsx`、`ComposerGhostText.tsx`、`ContextUsageIndicator.tsx`
- **受影响文件(修改)**:`docs/architecture/large-file-new-file-baseline.json` 与 `docs/architecture/large-file-new-file-baseline.md`(同步移除 1 条目)
- **不受影响**:
  - `ComposerInputResponsiveness.guard.test.ts` 读取的是 `ChatInputBoxAdapter.tsx`/`useComposerController.ts`/`Composer.tsx`,不读 `ComposerInput.tsx`,保留
  - `ChatInputBoxAdapter.tsx` 仅在注释中提及 ComposerInput,无 import
  - `Composer.tsx` 的 `isComposerInputInteractionActive` 等变量名仅为命名残留,无引用关系
  - `SpecHubPresentationalImpl.tsx` 依赖的 `ComposerAttachments`/`useComposerImageDrop` 保留,SpecHub 不受影响
- **API/依赖**:无变化
- **UI 影响**:无(被删组件在 UI 上不可达;现行输入框为 `ChatInputBox`)

## 验收标准

1. 上述 6 个源文件从工作树移除,`rg "ComposerInput\b|ComposerGhostText|ContextUsageIndicator" src/` 仅剩无关命名残留与注释(如 `isComposerInputInteractionActive`、guard test、adapter 注释)
2. `npm run typecheck` 通过
3. `npm run lint` 无新增错误
4. `npm run test` 全量通过(无因删除导致的测试失败)
5. `docs/architecture/large-file-new-file-baseline.json` 与 `docs/architecture/large-file-new-file-baseline.md` 均不再包含 `ComposerInput.tsx`，machine-readable / human-readable baseline 保持一致
6. `npm run check:large-files:gate` 不新增由本 change 引起的 violation；仓库既有 baseline debt 独立处理
7. 手动 smoke:会话输入框(ChatInputBox)可正常输入、发送、粘贴图片、使用 `/` 命令补全;SpecHub 页面(`#/spec`)正常打开
