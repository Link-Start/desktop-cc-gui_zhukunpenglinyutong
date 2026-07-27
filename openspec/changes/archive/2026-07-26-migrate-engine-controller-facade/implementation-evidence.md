# Implementation Evidence

## Ownership Map

| 原 controller 责任 | 新 owner | Facade 保留内容 |
|---|---|---|
| engine availability 与 UI label | `engineControllerAvailability.ts` + `engineRegistry.ts` | 调用探测并暴露稳定 snapshot |
| persisted engine selection | `engineControllerSelection.ts` | 编排 switch、回退与 debug |
| model normalize / custom / fallback / projection | `engineControllerCatalog.ts` | 请求 runtime catalog 并更新 state |
| storage revision lifecycle | `useEngineCatalogRevision.ts` | 消费 revision 触发 refresh |
| global runtime notices | `useEngineRuntimeNotices.ts` | 传入低频状态 |

`useEngineController.ts` 从 1005 行收口到 571 行。它仍是兼容 facade，但不再拥有 registry label、storage listener、catalog merge 或 notice dedupe。

## Render Boundary

- controller 返回值通过 `useMemo` 保持引用稳定。
- storage listener 被隔离到独立 hook，并在卸载时清理。
- facade 不接收 `AppShell` 的 `enabledEngines` 对象，避免无意义的根链重算。
- 未引入 per-delta、日志追加、轮询级 state；消息正文仍走既有 `liveAssistantTextChannel`。
- `check-engine-controller-facade.mjs` 阻止高频 token、旧 owner 和超 600 行 controller 回流。

## Verification

```text
pnpm vitest run \
  src/utils/engineExecutionPolicy.test.ts \
  src/features/engine/hooks/useEngineController.test.tsx \
  src/features/engine/hooks/engineControllerAvailability.test.ts \
  src/features/engine/hooks/useEngineCatalogRevision.test.tsx \
  src/features/engine/engineRegistry.test.ts \
  src/features/app/hooks/useSidebarMenus.test.tsx \
  src/app-shell.startup.test.tsx

7 files passed; 64 tests passed.
```

Additional gates:

- `pnpm tsc --noEmit`
- `pnpm check:engine-controller-facade`
- `pnpm check:engine-adapter-registry`
- `pnpm check:opencode-retirement`
- `pnpm check:large-files`
- `openspec validate migrate-engine-controller-facade --strict`
- `git diff --check`
