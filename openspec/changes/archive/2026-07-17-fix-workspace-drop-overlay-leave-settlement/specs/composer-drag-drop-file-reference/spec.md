## ADDED Requirements

### Requirement: Native drag-hover feedback MUST settle when drag leaves the application

系统通过 native WebView drag-drop bridge 展示 Composer 或 Workspace Sidebar drag-hover feedback 时，`DragDropEvent::Leave` MUST 被转发为统一 frontend `type: "leave"` terminal event。consumer 收到 leave 后 MUST 清理 active overlay state，并且 MUST NOT 因 leave payload 缺少有效 pointer position 而执行 target hit-test。

#### Scenario: External drag leaves the application before release

- **GIVEN** 用户将外部文件或文件夹拖入 Composer 或 Workspace Sidebar，且 hover overlay 已显示
- **WHEN** 用户把 pointer 移出应用窗口并在应用外松开
- **THEN** native WebView bridge MUST 向统一 drag-drop service 转发 `type: "leave"`
- **AND** active drag-hover overlay MUST 消失
- **AND** 系统 MUST NOT 等待一个不会到达应用的 DOM `drop` 或 `dragend` 事件

#### Scenario: Leave payload does not participate in target hit-testing

- **WHEN** frontend consumer 收到 forwarded `type: "leave"` payload
- **THEN** consumer MUST 将其作为 drag lifecycle terminal event
- **AND** consumer MUST clear hover state before any position-based branch
- **AND** leave payload 的 placeholder position MUST NOT 触发 drop/import/insertion
