# client-storage-performance

## ADDED Requirements

### Requirement: client store patch 写路径成本与 store 体积解耦

`client_store_patch` SHALL 避免在每次写入时对整份 store 做 full read+parse 与全量 deep equality：store 内容 SHALL 由进程内 cache 提供，equality 比较 SHALL 仅针对 patch 涉及的 key，序列化 SHALL 采用 compact JSON。原子写语义（tmp 文件 + fsync + rename）SHALL 保留。

#### Scenario: 小 patch 不触发整份 store 重解析
- **WHEN** renderer 对一个大体积 store（如数 MB 的 `threads.json`）发起单 key patch
- **THEN** Rust 侧从进程内 cache 取 existing 值，不重新读盘解析整份文件
- **AND** 仅比较 patch key 对应的旧值，no-op 时跳过写盘

#### Scenario: compact 序列化可回读
- **WHEN** store 以 compact JSON 写盘后再次读取
- **THEN** 数据与写入前 deep-equal

### Requirement: kanban 任务图片以文件形式存储

kanban 任务的粘贴图片 SHALL 落盘为 `client/kanban-images/` 下的图片文件，client store 中 SHALL 只保留文件路径。存量 base64 data URL SHALL 在加载时迁移为文件路径（best-effort，失败保留原值）。

#### Scenario: 粘贴图片即时落盘
- **WHEN** 用户在 kanban 任务弹窗粘贴截图
- **THEN** 图片经 `client_save_kanban_image` 写入磁盘，任务 `images` 中保存返回的文件路径

#### Scenario: 存量 base64 迁移
- **WHEN** 加载的 kanban store 中存在 `data:image/...;base64,` 条目
- **THEN** 异步迁移为文件路径并回写 store；迁移失败的条目保留原值

### Requirement: client store 存量维护在启动时执行

应用启动（`preloadClientStores` 完成）后 SHALL 执行一次 client store maintenance：`diagnostics.threadSessionLog` 按持久化黑名单过滤存量并施加单条 payload 与总条数上限；legacy `app` store 中的 `diagnostics.threadSessionLog` / `diagnostics.rendererLifecycleLog` SHALL 迁移合并后置空；`threads.customNames` SHALL 裁剪到容量上限（保留最近插入的 2,000 条）。

#### Scenario: threadSessionLog 存量清理
- **WHEN** 启动时 `diagnostics.threadSessionLog` 含有黑名单 label（如 `thread/list response`）或超限 payload 的存量条目
- **THEN** 黑名单条目被移除，超限 payload 被截断为 preview，总条数不超过上限

#### Scenario: legacy app store 死数据清退
- **WHEN** `app` store 中仍残留 `diagnostics.*` legacy key
- **THEN** 其内容合并入 `diagnostics` store 后，legacy key 置为 null

### Requirement: 高频写入源节流

`liveAssistantShadowTranscript` 的流式 delta SHALL 在内存聚合并按不低于 1s 的间隔 flush 到 client store；settle SHALL 立即 flush。新增 `threadSessionLog` 条目的 payload 序列化体积 SHALL 有上限，超限时截断。

#### Scenario: streaming delta 不逐条落盘
- **WHEN** Claude streaming 期间高频 delta 到达
- **THEN** 内存 store 即时更新，client store 写入按节流间隔合并

#### Scenario: settle 立即持久化
- **WHEN** transcript settle（turn 完成）
- **THEN** 立即 flush 到 client store，不等待节流窗口
