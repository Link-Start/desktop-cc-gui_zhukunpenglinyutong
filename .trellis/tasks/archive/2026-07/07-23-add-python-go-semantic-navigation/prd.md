# 接入 Python 与 Go 语义导航

## Goal

在现有 generic LSP runtime 中接入用户安装的 Pyright 与 gopls，使 Python/Go 支持 semantic definition、references、implementation，并保持现有 fallback、兼容与外部进程边界。

## OpenSpec

- Change: `add-python-go-semantic-navigation`

## Requirements

- Python 使用 external `pyright-langserver --stdio`；Go 使用 external `gopls`。
- 不新增 dependency、不打包或自动安装 provider。
- 复用现有 workspace session、timeout/cancel、fatal-only eviction、prewarm、retry 与 install hint。
- 保持 Tauri command/response、Java/Rust/TS/JS 与 file editor hot path 兼容。
- provider unavailable 时保留可解释 fallback；semantic empty result 不降级扫描。

## Acceptance Criteria

- [ ] Python/Go provider mapping、launch args 与 semantic routing 有 focused Rust coverage。
- [ ] `.py/.pyi/.go` prewarm 与 install guidance 有 focused Vitest coverage。
- [ ] timeout/fatal/unavailable 边界不破坏 session 或 editor。
- [ ] typecheck、lint、focused tests、runtime contracts、OpenSpec strict validation 通过。
- [ ] delta spec 已同步且 change 已归档。

## Technical Notes

以 `openspec/changes/add-python-go-semantic-navigation/` 为 behavior source of truth。只扩展 descriptor/routing，禁止复制 runtime。
