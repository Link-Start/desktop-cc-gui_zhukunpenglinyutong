# Tasks: remove-legacy-composer-input-implementation

## 1. 引用闭包复核(执行前已完成)

- [x] 1.1 [P0][depends:none][input: 全仓 grep][output: 删除清单确认][verify: `grep -rln` 结果显示仅 3 个测试 import `ComposerInput`] 确认 `ComposerInput.tsx` 仅被自身 3 个测试引用。
- [x] 1.2 [P0][depends:none][input: 全仓 grep][output: 孤儿清单确认][verify: `ComposerGhostText`/`ContextUsageIndicator` 仅出现于自身与 `ComposerInput.tsx`] 确认 2 个连带孤儿零外部引用。
- [x] 1.3 [P0][depends:none][input: `SpecHubPresentationalImpl.tsx` minified import 检查][output: 修正决定][verify: 发现 `from"../../../../composer/components/ComposerAttachments"` 真实 import] 将 `ComposerAttachments.tsx`/`useComposerImageDrop.ts`+测试 移出删除范围。
- [x] 1.4 [P0][depends:none][input: guard test / perf fixture / baseline 检查][output: 不受影响确认][verify: `ComposerInputResponsiveness.guard.test.ts` 不读 `ComposerInput.tsx`;`composerInputFixture50.ts` 无 import;baseline 仅 1 条目] 确认周边文件安全。

## 2. 删除执行

- [x] 2.1 [P0][depends:1.4][input: 删除清单][output: 6 个文件移除][verify: `git status` 显示 6 个 deleted] 删除 `ComposerInput.tsx` + 3 个测试 + `ComposerGhostText.tsx` + `ContextUsageIndicator.tsx`。
- [x] 2.2 [P0][depends:2.1][input: `docs/architecture/large-file-new-file-baseline.json`][output: 移除 `ComposerInput.tsx` 条目][verify: `grep ComposerInput` baseline 无结果] 同步 large-files baseline。
- [x] 2.3 [P1][depends:2.2][input: human-readable baseline review][output: `docs/architecture/large-file-new-file-baseline.md` 同步移除条目][verify: `rg -n 'src/features/composer/components/ComposerInput\\.tsx' docs/architecture/large-file-new-file-baseline.{json,md}` 无结果] 补正归档 review 发现的 machine-readable / human-readable baseline 漂移。

## 3. 验证

- [x] 3.1 [P0][depends:2.2][input: 删除后工作树][output: typecheck 通过][verify: `npm run typecheck` exit 0] 运行 typecheck。
- [x] 3.2 [P0][depends:2.2][input: 删除后工作树][output: gate 通过][verify: `npm run check:large-files:gate` exit 0] 运行 large-files gate。
- [x] 3.3 [P0][depends:2.2][input: 删除后工作树][output: composer 相关测试通过][verify: focused vitest on composer/search/spec exit 0] 运行受影响域 focused 测试。
- [x] 3.4 [P1][depends:3.1][input: 删除后工作树][output: lint 无新增错误][verify: `npm run lint` 无新增 error] 运行 lint。
- [x] 3.5 [P1][depends:2.3][input: 补正后的 archived change][output: OpenSpec strict validation 通过][verify: `openspec validate --all --strict --no-interactive` exit 0] 验证提案与 task 补正。

## 4. 归档

- [x] 4.1 [P0][depends:3.1,3.2,3.3][input: 完成的 change][output: 归档至 `changes/archive/`][verify: `openspec validate --all --strict --no-interactive` exit 0] 执行 `openspec archive remove-legacy-composer-input-implementation --skip-specs`。
