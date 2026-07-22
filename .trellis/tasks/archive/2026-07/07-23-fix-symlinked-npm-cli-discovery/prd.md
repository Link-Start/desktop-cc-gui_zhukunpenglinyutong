# Fix symlinked npm CLI discovery

## Goal

修复 desktop GUI 在 npm launcher 为 symlink 且 Node runtime 多版本共存时无法发现 npm global language server 的问题。

## Requirements

- 关联 OpenSpec change：`fix-symlinked-npm-cli-discovery`。
- 使用 selected npm launcher 的 canonical parent 优先解析 npm runtime dependency。
- 保持 macOS/Linux、Windows wrapper、explicit override 与 fallback 兼容。
- 不增加 vendor-specific path 或 dependency。

## Acceptance Criteria

- [ ] symlinked npm regression test 通过。
- [ ] Windows wrapper/prefix tests 不回退。
- [ ] Pyright shared discovery path 可解析 Hermes 安装目录。
- [ ] OpenSpec strict validation 通过。

## Technical Notes

只修改共享 backend CLI resolver；frontend 与 LSP provider descriptor 无需特判。
