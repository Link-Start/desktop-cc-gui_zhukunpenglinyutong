# Tasks: remove-jcef-bridge-noop-stubs

## 1. 删除纯死文件

- [x] 1.1 删除 `src/features/composer/utils/bridge.ts`(73 行全 no-op;引用闭包已验证:仅 slashCommandProvider / promptProvider / useInputHistory 及两个测试文件 import)。
- [x] 1.2 删除 `src/features/composer/components/ChatInputBox/providers/createBridgeProvider.ts`(231 行;全仓零 import,含 type export)。

## 2. 清理死链调用点

- [x] 2.1 `slashCommandProvider.ts`:移除 bridge import;移除 `window.updateSlashCommands` 注册块(含 originalHandler 链式包装与 `callbackRegistered` 状态);`requestRefresh()` 移除 `sendBridgeEvent` 调用及 `'refresh not sent'` 死分支,保行为语义直接 `return false`(不可达的 state mutation 一并移除)。
- [x] 2.2 `promptProvider.ts`:移除 bridge import;`requestRefresh()` 同 2.1 处理(`window.updatePrompts` 注册保留,不在锚点内)。
- [x] 2.3 `useInputHistory.ts`:移除 bridge import 与 7 处 `sendToJava` 调用及配套 "sync to backend/.ccgui" 注释;修正 `deleteHistoryItem` / `clearAllHistory` 的 "Dual-write" 过时注释。

## 3. 测试适配

- [x] 3.1 `slashCommandProvider.test.ts`:移除 bridge `vi.mock` 与 `bridgeState`;payload 注入改用 `__pendingSlashCommands` 路径,保持归一化行为断言不变。
- [x] 3.2 `useInputHistory.test.ts`:移除 bridge `vi.mock`(断言本就不依赖 sendToJava)。

## 4. 验证与交付

- [x] 4.1 `npm run typecheck` 通过。
- [x] 4.2 改动文件 `npx eslint` 零新增告警。
- [x] 4.3 聚焦 vitest 两个测试文件全绿。
- [x] 4.4 全仓 grep 确认无 `utils/bridge` / `createBridgeProvider` 残留引用。
- [x] 4.5 中文 Conventional Commits 提交 + Trellis session record。
