# Verification

## Summary

| Dimension | Result |
|---|---|
| Completeness | 16/16 tasks；3 capability deltas；all implemented |
| Correctness | Provider-aware Target、product Dialog、readable continuation projection 均有实现与 tests |
| Consistency | 遵循 existing targetStore、Tauri service、Radix UI、catalog projection；无新依赖 |

## Requirement Evidence

- Shared Provider-aware Picker：
  `ModelSelect.tsx`、`useSharedProviderTargetCatalog.ts`、`Composer.tsx`。
- Product-controlled Continuation：
  `useSidebarMenus.ts`、`ProviderContinuationDialog.tsx`。
- Readable identity/source navigation：
  `contextProtocol.ts`、`MessagesCore.tsx`、
  `ProviderContinuationContextCard.tsx`、`useThreadActions.helpers.ts`。
- Kimi capability boundary：Shared picker 与 Native continuation menu 均 visible-disabled，
  不开放未验证 target acceptance。
- Cross-platform：frontend 无 path/shell/platform dialog 分支；所有交互使用 React/Radix
  与既有 Tauri service contract。
- Performance：Profile catalog module cache；Model catalog 按 CLI hover/binding lazy load；
  无 AppShell polling、per-event root state 或全 catalog mount preload。

## Automated Evidence

```text
Frontend: 26 files, 256 passed, 2 skipped
i18n: 5 passed
Rust: 40 passed
typecheck: pass
scoped ESLint: 0 errors, 0 warnings
runtime contracts: pass
model provider catalog contract: pass
Markdown table/link check: pass
OpenSpec strict validation: pass
```

`check:large-files` 仅报告仓库既有 baseline 超限文件；本 change 新增文件未超限。
Rust 输出包含仓库既有 warnings，本 change 未修改对应 Rust source。

## Review Findings Resolved

1. local profile sentinel 会产生 duplicate default Binding：统一归一为 `null`。
2. `??` 会让 explicit local/reasoning-null 回退旧 UI 值：改为 target-presence 判断。
3. 切换后按钮仍从旧 Engine catalog 解析 Model：改读完整 Target catalog。
4. 一项 Provider catalog 失败会影响可用性：按 CLI/Profile 隔离并保留默认/last-good。
5. native/Tauri confirmation 不受产品控制：改为 product Dialog、command-before-confirm gate。
6. raw marker/title/default 暴露：严格 classifier、可读 title、本地配置文案与来源卡片。
7. 来源查询重复扫描：一次 memoized lookup，复用 source 与 navigation。

## Remaining Manual Gate

真实 Desktop Claude Provider A → Codex Provider B → Claude Provider A smoke 仍是发布前 gate。
按 impact report 的 MT-B00、MT-B01、MT-C02、MT-D00、MT-D01、MT-D06 执行。
