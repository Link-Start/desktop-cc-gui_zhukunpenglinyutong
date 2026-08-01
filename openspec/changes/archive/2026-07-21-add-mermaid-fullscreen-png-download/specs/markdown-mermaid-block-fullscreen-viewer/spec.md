## ADDED Requirements

### Requirement: Mermaid Fullscreen Viewer MUST Provide PNG Download

`MermaidFullscreenViewer` MUST 在 viewer 外层提供共享的 PNG 下载 control，使消息侧与文件预览侧无需各自实现导出逻辑。control MUST 位于 fullscreen 右下角、高于 viewer container，使用 i18n 文案与 accessible name，且 MUST NOT 改变 viewerjs 内置 8 个 toolbar actions。

#### Scenario: 两个 Mermaid surface 共用下载入口

- **WHEN** 消息侧或文件预览侧以非空 SVG 打开 `MermaidFullscreenViewer`
- **THEN** fullscreen 右下角 MUST 显示“下载 PNG”control
- **AND** control MUST 具有本地化 accessible name
- **AND** `.viewer-toolbar > ul` 仍 MUST 仅包含既有 8 个 action

#### Scenario: 下载期间禁止重复触发

- **WHEN** 用户点击下载且 PNG conversion 尚未完成
- **THEN** 下载 control MUST 处于 disabled 状态
- **AND** MUST 显示本地化 downloading 状态
- **AND** 再次点击 MUST NOT 启动第二个并发 conversion

### Requirement: Mermaid PNG Export MUST Be Bounded And Resource-Safe

PNG export MUST 复用 viewer lifecycle 中得到的 XML-safe SVG Data URL，经浏览器 `Image` 与 Canvas rasterization 输出 `image/png`。目标 scale MUST 为 2x，最终尺寸 MUST 保持 aspect ratio，并同时受 16384px 最大边长与 32M pixels 最大总像素约束。临时 Object URL MUST 在成功或失败路径释放。

#### Scenario: 常规图以 2x 透明 PNG 下载

- **WHEN** SVG 逻辑尺寸在 2x 后未触达任何预算上限
- **THEN** Canvas width 与 height MUST 分别为逻辑尺寸的 2 倍
- **AND** Canvas MUST NOT 主动填充背景色
- **AND** 下载文件名 MUST 为 `mermaid-diagram.png`
- **AND** Blob MIME MUST 为 `image/png`

#### Scenario: 超大图按预算等比缩放

- **WHEN** SVG 以 2x rasterize 会超过 16384px 单边或 32M pixels
- **THEN** exporter MUST 选择满足两项预算的最大 scale
- **AND** width/height ratio MUST 保持原图 aspect ratio
- **AND** exporter MUST NOT 创建超过预算的 Canvas

#### Scenario: Unicode 与 XHTML SVG 使用 viewer normalization path

- **WHEN** Mermaid SVG 包含中文、日文、Emoji 或 `<foreignObject>` XHTML label
- **THEN** exporter MUST 使用与当前 fullscreen image 相同的 XML-safe Data URL 作为 decoded image source
- **AND** MUST NOT 在 React render path 执行 SVG normalization 或 Canvas rasterization

#### Scenario: 下载完成后释放 Object URL

- **WHEN** PNG Blob 已触发 anchor download 或下载流程抛出异常
- **THEN** exporter MUST 移除临时 anchor
- **AND** Object URL MUST 被 revoke

### Requirement: Mermaid PNG Download Failure MUST Remain Recoverable

PNG decode、Canvas context、draw 或 Blob encoding 失败时，fullscreen viewer MUST 保持打开，下载 control MUST 恢复可用，并显示不包含 SVG source 的本地化错误反馈。

#### Scenario: Canvas conversion 失败

- **WHEN** image decode、Canvas context 或 `toBlob` 失败
- **THEN** viewer MUST NOT 自动关闭
- **AND** 下载 control MUST 从 downloading 恢复为可操作状态
- **AND** fullscreen MUST 显示本地化失败信息
- **AND** error feedback MUST NOT 包含原始 SVG source
