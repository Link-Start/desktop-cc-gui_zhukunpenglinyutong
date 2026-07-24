# Tasks: remove-parallel-orphan-module

## 1. 引用闭包复核(执行前已完成)

- [x] 1.1 [P0][depends:none][input: 全仓 grep][output: 零外部引用确认][verify: `grep -rln "useParallelWorkspace\|features/parallel" src` 除目录自身外无匹配] 确认 src 内零外部引用。
- [x] 1.2 [P0][depends:none][input: `src-tauri/src`、`scripts/` grep][output: 跨层零引用确认][verify: 无匹配] 确认 Rust 侧与脚本零引用。
- [x] 1.3 [P0][depends:none][input: 目录结构检查][output: 无 barrel 确认][verify: 目录仅含 `types.ts`、`hooks/` 两文件,无 `index.ts`] 确认无 barrel 导出间接暴露。

## 2. 删除执行

- [x] 2.1 [P0][depends:1.3][input: 删除清单][output: 目录移除][verify: `git status` 显示 3 个 deleted] 删除 `src/features/parallel/` 整目录(3 个文件)。

## 3. 验证

- [x] 3.1 [P0][depends:2.1][input: 删除后工作树][output: typecheck 通过][verify: `npm run typecheck` exit 0] 运行 typecheck。
- [x] 3.2 [P1][depends:3.1][input: 删除后工作树][output: lint 无新增错误][verify: `npm run lint` 无新增 error] 运行 lint。

## 4. 归档

- [x] 4.1 [P0][depends:3.1][input: 完成的 change][output: 归档至 `changes/archive/`][verify: `openspec validate --all --strict --no-interactive` exit 0] 执行 `openspec archive remove-parallel-orphan-module --skip-specs`。
