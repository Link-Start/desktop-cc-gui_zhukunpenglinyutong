# Tasks: remove-search-workspace-indexing-layer

## 1. 引用闭包复核(执行前已完成)

- [x] 1.1 [P0][depends:none][input: 全仓 grep][output: 死子集确认][verify: `buildWorkspaceIndex`/`syncWorkspaceIndex`/`indexItem` 的引用者全部位于 indexing 目录删除清单内] 确认 3 个源文件仅被目录内死代码引用。
- [x] 1.2 [P0][depends:none][input: `messageProvider.ts:2`][output: 活路径确认][verify: 仅 `import { buildWorkspaceMessageIndex, makeMessageSnippet } from "../indexing/messageIndex"`] 确认 `messageIndex.ts` 为生产活代码,保留。
- [x] 1.3 [P0][depends:none][input: `messageIndex.test.ts`][output: 保留测试独立性确认][verify: 仅 import `./messageIndex`] 确认保留的测试不依赖被删文件。
- [x] 1.4 [P0][depends:none][input: `scripts/`、`src-tauri/src` grep][output: 零跨层引用确认][verify: 无匹配] 确认无脚本/Rust 侧引用。

## 2. 删除执行

- [x] 2.1 [P0][depends:1.4][input: 删除清单][output: 8 个文件移除][verify: `git status` 显示 8 个 deleted] 删除 3 个源文件 + 5 个测试,保留 `messageIndex.ts`/`messageIndex.test.ts`。

## 3. 验证

- [x] 3.1 [P0][depends:2.1][input: 删除后工作树][output: typecheck 通过][verify: `npm run typecheck` exit 0] 运行 typecheck。
- [x] 3.2 [P0][depends:2.1][input: 删除后工作树][output: search 域测试通过][verify: focused vitest on search exit 0] 运行 search focused 测试。
- [x] 3.3 [P1][depends:3.1][input: 删除后工作树][output: lint 无新增错误][verify: `npm run lint` 无新增 error] 运行 lint。

## 4. 归档

- [x] 4.1 [P0][depends:3.1,3.2][input: 完成的 change][output: 归档至 `changes/archive/`][verify: `openspec validate --all --strict --no-interactive` exit 0] 执行 `openspec archive remove-search-workspace-indexing-layer --skip-specs`。
