# Proposal: 新增文件 800 行 large-file ratchet

## Why

当前 large-file hard gate 只在文件超过 domain policy fail threshold（2600/2800/3000 行）时阻断。
这能治理旧债，但无法阻止刚拆出的新模块重新长成 1000+ 行 hub。最近的 `app-shell.tsx`、
`src/services/tauri.ts` 和 `src/types.ts` 拆分已经降低了入口压力，下一步需要把新增文件的
行数上限前移到 800 行。

## 目标与边界

- 新增 governed source/test/style/script 文件超过 800 行时，`npm run check:large-files:gate`
  必须 fail。
- 当前仓库已有的 800+ 文件不因为本次策略切换被一次性误判为新 debt；它们由单独的
  new-file ratchet baseline 记录，继续按 legacy policy fail threshold 治理。
- 原 hard-debt baseline 继续只记录超过 domain policy fail threshold 的存量债务，不和
  800 行 ratchet 快照混用。
- 不在本 change 内继续拆具体业务文件；这一步只加防反弹门禁。

## What Changes

- 在 `scripts/check-large-files.policy.json` 增加 `newFileFailThreshold: 800`。
- 在 `scripts/check-large-files.mjs` 增加 `--new-file-baseline-file` 和 `--scope new-file`：
  - `new-file` scope 生成当前 800+ governed file 快照；
  - fail scope 加载该快照后，对缺席且超过 800 行的文件输出
    `severity=fail, status=new, threshold=new-file-ratchet`。
- 新增 `docs/architecture/large-file-new-file-baseline.*` 作为当前 ratchet 快照。
- 更新 npm scripts、playbook 和 parser tests。

## Impact

- Governance scripts:
  - `scripts/check-large-files.mjs`
  - `scripts/check-large-files.test.mjs`
  - `scripts/check-large-files.policy.json`
- Docs:
  - `docs/architecture/large-file-governance-playbook.md`
  - `docs/architecture/large-file-new-file-baseline.*`
- Scripts:
  - `package.json`

## 验收标准

- `node --test scripts/check-large-files.test.mjs` passes。
- `npm run check:large-files:new-file-baseline` 能生成当前 800+ 文件快照。
- `npm run check:large-files:gate` 在当前仓库通过，但如果新增 800+ 文件缺席 ratchet baseline 会失败。
- `npm run check:large-files`、`npm run check:large-files:near-threshold` 可继续输出治理证据。
- `openspec validate ratchet-large-file-new-files --strict --no-interactive` passes。
