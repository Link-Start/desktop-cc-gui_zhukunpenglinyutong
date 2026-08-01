## Context

`MermaidFullscreenViewer` 已作为消息区和文件预览区共享的 viewerjs adapter。它在 open effect 中把 Mermaid SVG 规范化为 XML-safe UTF-8 Base64 Data URL，再交给 `<img>` 和 viewerjs。仓库同时存在未被调用的 `downloadSvg()`，但没有 PNG rasterization、尺寸预算或用户反馈。

本变更是纯 frontend behavior change。关键约束是不能把 SVG normalization 或 Canvas 工作放进 conversation render hot path，也不能破坏 viewerjs 的 singleton、cleanup 和固定 8 个内置 toolbar action。

## Goals / Non-Goals

**Goals:**

- 在共享 fullscreen viewer 中只实现一次 PNG 下载，自动覆盖消息与文件预览 surface。
- 输出 2x、透明背景的 PNG，同时通过最大边长与总像素预算控制内存。
- 对下载中、成功清理与失败反馈建立明确 lifecycle。
- 复用现有 XML-safe Data URL，不引入第三方依赖。

**Non-Goals:**

- 不扩展 viewerjs 内置 toolbar schema。
- 不提供格式、倍率、背景色和文件名设置。
- 不调用 Tauri backend 或系统文件 dialog。

## Decisions

### Decision 1: 使用 viewer 外层 overlay control，不修改 viewerjs toolbar

下载按钮由 `MermaidFullscreenViewer` 的 portal 渲染为 fixed bottom-right control，z-index 高于 viewer container。这样保留当前 viewerjs 8-button contract，并避免 fork/patch viewerjs DOM。

替代方案是 viewer `shown` 后向 `.viewer-toolbar` 注入 `<li>`。该方案依赖第三方内部 DOM、theme sprite 与 destroy 时机，升级脆弱，因此不采用。

### Decision 2: 原生 Image + Canvas rasterization

新增 feature-local async helper：接收原始 SVG 与已规范化 Data URL，等待 `Image` decode，依据 SVG `viewBox`/尺寸属性确定逻辑尺寸，按预算创建 Canvas，`drawImage` 后调用 `toBlob("image/png")`，最后用临时 anchor 下载。

替代方案一是沿用 `downloadSvg()`，但格式不符。替代方案二是引入 SVG export library，但原生 Web API 已覆盖需求，新增 bundle 与维护成本不成立。现有未使用的 `downloadSvg()` 将被 PNG helper 替代，避免保留两个无统一入口的下载实现。

### Decision 3: 2x 上限而非固定 2x

目标 scale 为 2；最终 scale 同时受最大边长 16384px 与最大 32M pixels 约束，并始终保持 aspect ratio。常规图获得清晰导出，超长 sequence diagram 则等比降采样，避免 Canvas allocation 失控。

尺寸解析使用 inert DOM parser，不手写 SVG/XML parser。优先 `viewBox`，其次 numeric width/height，最后回退 decoded image 的 natural size。非法或零尺寸视为可反馈错误。

### Decision 4: 组件内显式状态与本地化反馈

按钮点击期间 disabled 并显示 downloading 文案，防止并发导出。异常在组件边界归一化为本地化失败文案，viewer 保持打开；helper 的 `finally` 必须释放 Object URL。错误信息不包含完整 SVG source。

## Risks / Trade-offs

- [部分 WebView 对含 `foreignObject` 的 SVG Canvas rasterization 支持不一致] → 使用 viewer 已验证可加载的 XML-safe Data URL，并增加成功与 reject tests；失败时保留 viewer 并反馈。
- [超大图降采样后不是严格 2x] → 以稳定性优先，spec 明确 2x 是目标倍率、像素预算是硬边界。
- [透明背景在深色图表中可能影响外部查看] → 当前 scope 保留 Mermaid 原始视觉且不擅自填色；背景选择器留作未来独立需求。
- [浏览器下载策略差异] → 使用现有项目通用的 Blob/Object URL/anchor 模式，并延迟 revoke。

## Migration Plan

1. 增加 delta spec 与 focused tests。
2. 用 PNG helper 替换未接入的 SVG helper，并接入共享 viewer overlay。
3. 同步 i18n 与 theme CSS，运行 focused tests、typecheck、lint 和 OpenSpec strict validation。
4. 回滚时删除 overlay/helper/i18n/CSS，viewerjs 原链路不受影响。

## Open Questions

无。倍率、背景、位置和文件名已由用户确认的 PLAN 固定。
