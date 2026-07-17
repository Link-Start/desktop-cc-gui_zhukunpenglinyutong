## Why

`0.7.3` production cold start still intermittently reaches React `#185` while Sidebar workspace rows and Radix `Presence` are repeatedly committed. The current dependency graph violates the existing Sidebar ScrollArea contract: `@radix-ui/react-scroll-area@1.2.14` requires `@radix-ui/react-presence@1.1.7`, while the scoped override still pins `Presence@1.1.6`, causing `npm ls` to report an invalid tree.

## What Changes

- Align the `radix-ui`-scoped `@radix-ui/react-presence` override with the exact version required by the fixed ScrollArea patch.
- Refresh the lockfile without upgrading the full `radix-ui` aggregate package or unrelated Radix consumers.
- Strengthen the dependency-resolution regression so an invalid ScrollArea/Presence pair cannot pass focused tests again.
- Exercise a production-shaped Sidebar surface with multiple workspace rows under React `StrictMode`, asserting bounded render/ref convergence and no React `#185` signal.

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `sidebar-scroll-area-react19-stability`: dependency resolution MUST keep the fixed ScrollArea and its exact Presence dependency compatible, and Sidebar multi-row startup MUST converge without maximum-update-depth failures.

## Impact

- Affected files: `package.json`, `package-lock.json`, `src/components/ui/scroll-area.test.tsx` and focused Sidebar regression tests if needed.
- Dependencies: only the `radix-ui` aggregate package's scoped `@radix-ui/react-presence` override moves from `1.1.6` to `1.1.7`; Excalidraw and independent Radix trees remain unchanged.
- APIs / storage / backend: no changes.

## 目标与边界

- 目标：恢复 valid dependency tree，并切断 Sidebar cold-start 中混合 Presence patch 的不确定性。
- 边界：只处理与 fixed ScrollArea 直接相连的 Radix dependency contract 和启动回归，不修改 AppShell 业务 state。

## 非目标

- 不整体升级 `radix-ui`。
- 不重写 Sidebar 为 native scrolling。
- 不把所有 React `#185` 都归因于同一原因。
- 不修改 Excalidraw 自带的旧 Radix dependency tree。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 对齐 scoped Presence patch | 将 `radix-ui > Presence` 对齐到 ScrollArea 要求的 `1.1.7` | 最小 diff，恢复 valid tree，保留 `1.1.6` 已有 fix | 仍需真实组合回归证明 | 采用 |
| B. 整体升级 `radix-ui` | 升级 aggregate package | 可获得更多 upstream fixes | 同时改变几十个 primitives，回归面过大 | 不采用 |
| C. Sidebar 改原生滚动 | 移除 Radix ScrollArea | 完全避开 primitive ref lifecycle | 样式、可访问性和滚动行为改动大 | 不采用 |

## 验收标准

- `npm ls radix-ui @radix-ui/react-presence @radix-ui/react-scroll-area --all` 退出码为 `0`，不得包含 `invalid`。
- `radix-ui` scoped ScrollArea 与 Presence 解析为兼容版本，独立 dependency tree 不被 broad override 改写。
- Sidebar 多 workspace/row StrictMode 回归不报告 `Maximum update depth exceeded` 或 minified React `#185`。
- Focused tests、lint、typecheck、production build 与 strict OpenSpec validation 通过。
