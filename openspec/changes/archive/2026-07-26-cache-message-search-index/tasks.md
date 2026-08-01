## 1. Index Cache

- [x] 1.1 [P0, depends: none] 输入 `messageIndex.ts` 当前全量 builder；输出 snapshot-scoped weak cache、稳定 thread signature 与 `normalizedText`；验证相同 snapshot 返回同一引用，新 snapshot 返回新索引
- [x] 1.2 [P0, depends: 1.1] 输入 `messageProvider.ts` 当前 query-time lowercase；输出复用 indexed normalized text 且保持 score/snippet/result identity；验证 provider focused tests

## 2. Regression Verification

- [x] 2.1 [P0, depends: 1.1, 1.2] 输入 cache/spec contract；输出 cache hit、snapshot invalidation、case-insensitive、empty/non-message regression tests；验证 focused Vitest
- [x] 2.2 [P1, depends: 2.1] 输入 touched files 与 OpenSpec artifacts；输出 targeted ESLint、TypeScript typecheck、strict OpenSpec validation 结果
