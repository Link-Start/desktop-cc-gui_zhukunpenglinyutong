## 验证报告：fix-tooltip-startup-update-loop

### 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 8/8 tasks；1/1 requirement |
| 正确性 | 3/3 scenarios 有实现、regression 或人工 Tauri evidence |
| 一致性 | 遵循 native button + Floating UI portal、no Radix Tooltip context/Slot design |

### 实现证据

- `src/components/ui/tooltip.tsx`: 提取共享 popup visual class，并删除 Base UI `render` compatibility branch。
- `src/components/ui/tooltip-icon-button.tsx`: 使用 native button + `useFloating/autoUpdate/offset/flip/shift` + body portal；不挂载 Radix Tooltip Root/Trigger/PopperAnchor。
- `src/components/ui/tooltip-icon-button.test.tsx`: 覆盖真实 `SidebarCollapseButton`、StrictMode、tooltip open 与 layout host remount，断言无 maximum update depth。
- `package.json` / `package-lock.json`: `@floating-ui/react-dom@2.1.7` 为 direct dependency，而非依赖 Radix 的 transitive tree。

### 验证命令

- `npx vitest run src/components/ui/tooltip-icon-button.test.tsx src/app-shell.startup.test.tsx`: 2 files / 17 tests passed。
- tests 覆盖 styled body portal、shared theme class、custom class、requested placement、fixed strategy 与 ARIA linkage。
- `npm run typecheck`: passed。
- `npm run lint`: passed。
- `npm run check:large-files`: exit 0；仅报告两个未触碰的 existing items。
- `openspec validate fix-tooltip-startup-update-loop --strict --no-interactive`: passed。
- legacy screenshot asset `dist/assets/App-CwNlTwcP.js` timestamp 为 2026-07-12 21:31，属于 `a463a259` 后的旧 production bundle；React #185 与 maximum update depth 同根，不是新增异常。
- `npm run tauri:dev:hot`: Rust/Vite 启动完成；用户人工确认新窗口暂未报错、可收口。

### 问题

- CRITICAL: none。
- WARNING: none。
- WARNING: `npm run build` 在 Vite transform 阶段被本机系统终止，未生成新 production asset；本次 closure 基于 focused gates + Tauri WebView cold-start 人工验收，不声称 release bundle 已验证。

### 最终评估

实现与 artifacts 对齐，无关键问题；Tauri WebView 人工验收通过，production bundle 重建留作 release pipeline 验证项。
