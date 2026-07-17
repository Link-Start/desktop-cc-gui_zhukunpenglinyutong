# Add API Endpoint Global Search

## OpenSpec

- Change: `add-api-endpoint-global-search`

## Goal

在全局搜索中检索 Project Map 已识别的全部 API endpoint，并在缓存缺失或 stale 时自动触发磁盘扫描。

## Requirements

- 支持 path、HTTP method + path、handler、operation、description 与非 HTTP endpoint 查询。
- 区分 loading、complete/empty、error，不把未扫描误判为空。
- query 输入只搜索内存 snapshot。
- 保留并行 `fix-global-file-search-hydration` 的全部能力。

## Acceptance Criteria

- [x] cache missing 会执行磁盘 scan 并刷新 endpoint results。
- [x] API provider 支持 fast-request 风格查询。
- [x] API hydration 与 file hydration 独立呈现。
- [x] 选择 endpoint result 可切换 workspace 并打开 source file。
- [x] focused tests、typecheck、lint、runtime contracts 与 OpenSpec validation 通过。
