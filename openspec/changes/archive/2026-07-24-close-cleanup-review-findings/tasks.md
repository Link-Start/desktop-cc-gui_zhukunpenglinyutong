## 1. Composer legacy bridge cleanup

- [x] 1.1 [P0, 无依赖] 删除 slash command 无 producer callback/waiter/retry state；输出 local fallback；用 focused Vitest 验证即时返回
- [x] 1.2 [P1, 依赖 1.1] 删除 prompt provider legacy global callback/waiter/retry state与 Window declarations；用 typecheck 验证 consumer contract

## 2. Semantic review correctness

- [x] 2.1 [P0, 无依赖] 将 cache key 绑定 language 与 diff fingerprint；focused hook test 验证 entries/language 变化触发新 request
- [x] 2.2 [P0, 无依赖] 删除不可取消 request 的 frontend-only timeout；focused util test/typecheck 验证 fallback 仍串行

## 3. Storage and notice cleanup

- [x] 3.1 [P0, 无依赖] 为 corrupted backup target 增加 UUID；focused cargo test 验证同秒连续 quarantine 保留两个文件
- [x] 3.2 [P2, 无依赖] 删除 runtime notice dock 不可达 indicator/status CSS 与重复 placement write；focused component test验证现有状态

## 4. Verification and closure

- [x] 4.1 [P0, 依赖 1-3] 运行 typecheck、focused ESLint/Vitest/cargo、git diff check
- [x] 4.2 [P0, 依赖 4.1] strict validate、verify、sync/archive OpenSpec change并提交原子 commits
