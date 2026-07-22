# Fix multi-runtime npm CLI discovery

## Goal

支持同机并存的多个 Node/npm runtime，确保 desktop GUI 能发现任一 supported launcher chain 中安装的 language server。

## Requirements

- OpenSpec：`fix-multi-runtime-npm-cli-discovery`。
- bounded follow npm symlink hops。
- env prefix、primary npm prefix、all launcher bin directories 合并去重。
- macOS/Linux 与 Windows wrapper 兼容。

## Acceptance Criteria

- [ ] multi-runtime regression test 通过。
- [ ] nested npm symlink regression test 通过。
- [ ] shared resolver 与 LSP tests 通过。
- [ ] real Pyright initialize smoke 通过。

## Technical Notes

不覆盖并行 current Trellis task；本 task 仅作为独立执行记录。
