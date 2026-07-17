## Why

当前全局搜索无法检索 workspace 中的 API endpoint；已有 Project Map API contract scanner 具备多语言、多协议识别能力，但其索引只在完整 relationship scan 后存在。用户从未扫描 Project Map、缓存缺失或缓存 stale 时，接口搜索会错误地表现为空，因此需要建立面向搜索的轻量 endpoint index 生命周期。

## 目标与边界

- 全局搜索 SHALL 覆盖 Project Map 已识别的全部 endpoint 类型，包括 HTTP、RPC、GraphQL、ABI 与 source candidate。
- 搜索语义参考 fast-request SearchEverywhere：支持 path、`method + path`、handler / operation、description 等关键词。
- endpoint 搜索 MUST 使用内存索引响应输入；磁盘扫描只能作为 cache miss / stale 后的异步 hydration。
- endpoint index MUST 与 workspace identity 绑定，并区分 loading、ready、empty、stale、error 状态。
- 并行开发中的 file search hydration 行为 MUST 保持不变，接口索引状态不得覆盖或复用 file hydration 状态。

## 非目标

- 不新增 API 调试、请求发送、参数生成或 Postman export 能力。
- 不复制 fast-request 的 AGPL 实现代码，仅参考其搜索语义。
- 不要求用户先打开 Project Map，也不在每次 query 变化时扫描磁盘。
- 不重写 Project Map 已有 endpoint extractor。

## What Changes

- 新增 lazy endpoint hydration：优先读取 workspace-scoped Project Map cache，在 cache missing / stale 时异步触发现有受限磁盘 scan 并读取原子更新后的 API contract。
- 扩展 unified search 的 result kind、content filter、provider limits、ranking evidence 与 grouped presentation，增加 API endpoint provider。
- 支持 `/path`、`GET /path`、handler、operation、description、framework、protocol、module/source file 查询。
- 增加 endpoint index hydration 状态反馈；只有完成扫描且无 endpoint 时才显示确认空状态。
- 选择 endpoint result 后切换到目标 workspace 并打开 source file；存在可靠 line evidence 时定位到具体位置。
- 增加 backend contract tests、frontend provider / grouping / hydration / navigation tests 与性能回归门禁。

## 方案对比与取舍

1. 直接调用完整 `project_map_relationship_scan`：复用最多，但会同时构建 relations、symbols、impact 和 context pack，搜索冷启动成本过高。
2. 重新实现专用 endpoint parser：表面独立，但会与 Project Map scanner 产生 parser drift。
3. **采用：复用完整 Project Map scan lifecycle**。现有 command 已统一实现 ignore rules、file budget、ownership、stale detection、locking 与 atomic write；搜索侧只负责 lazy trigger、session dedupe 和内存 provider。该方案冷启动工作量高于 endpoint-only walker，但避免第二套 walker / cache contract 漂移。

## 验收标准

- 未运行过 Project Map scan 的 workspace 打开接口搜索后会进入 loading，并在后台磁盘扫描完成后显示 endpoint。
- cache hit 时不触发磁盘扫描；stale cache 可先提供旧结果并后台刷新。
- `GET /users`、`/users`、handler / operation / description 查询均能返回对应 endpoint。
- 多 workspace 搜索结果保留 workspace identity，选择后能打开正确 source file。
- endpoint scan error 不影响 file、thread、message 等其他 provider。
- query 输入期间不触发磁盘 IO，且现有 global file hydration tests 保持通过。

## Capabilities

### New Capabilities

- `global-search-api-endpoint-index`: 定义 endpoint-only cache、磁盘 hydration、状态、搜索语义与源码导航契约。

### Modified Capabilities

- `global-search-result-presentation`: 增加 API endpoint result section、filter、metadata 与 keyboard selection presentation。

## Impact

- Backend / Bridge: 复用既有 `project_map_relationship_read` / `project_map_relationship_scan` contract，不新增 command。
- Frontend: `src/features/search/**`、AppShell search orchestration、SearchPalette、i18n 与样式。
- Storage: workspace-scoped API contract cache；复用现有 atomic write 与 ownership validation。
- Dependencies: 不新增第三方 dependency。
