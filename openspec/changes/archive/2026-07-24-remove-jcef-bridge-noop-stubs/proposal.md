# Proposal: remove-jcef-bridge-noop-stubs

## 背景与业务判断

ccgui 已从 idea-claude 的 JCEF(WebView ↔ Java bridge)架构迁移到 Tauri 2,但 composer 输入链路残留了一层 JCEF bridge no-op 桩与死链调用点。已归档提案 `2026-07-24-remove-legacy-composer-input-implementation`(proposal.md 明确"另行提案 `remove-jcef-bridge-noop-stubs`")许诺由本提案完成清理。

死代码事实(删除前已逐一 grep 验证引用闭包):

- `src/features/composer/utils/bridge.ts`(73 行):全部 export 均为 no-op;`sendBridgeEvent` 恒返回 `false`,`sendToJava` 等为空函数。
- `src/features/composer/components/ChatInputBox/providers/createBridgeProvider.ts`(231 行):全仓零 import(仅自身定义,含 type export 亦无引用)。
- 死链调用点:
  - `slashCommandProvider.ts`:`sendBridgeEvent('refresh_slash_commands')` 恒返回 false,`requestRefresh()` 永远在 `'refresh not sent'` 分支提前 return,其后的 state mutation 在生产与测试中均不可达;`window.updateSlashCommands` 注册(src-tauri 侧无任何调用方,grep 全仓仅 provider 自身与测试引用)。
  - `promptProvider.ts`:`sendBridgeEvent('get_prompts')` 同构死路。
  - `useInputHistory.ts`:7 处 `sendToJava(...)`(任务描述称 8 处,实际 grep 为 7 处)经 bridge no-op 转发,`delete_input_history_item` / `clear_input_history` / `record_input_history` 三个 message 在全仓(含 src-tauri)无任何 handler,同步链路为纯死写。

注意区分活路径:`window.sendToJava`(vite-env.d.ts:15 声明,`fileReferenceProvider.ts` 使用,带 availability check)与 `usePromptEnhancer` 的 `window.updateEnhancedPrompt` 是独立机制,不在本提案范围。

## 目标

- 删除 `bridge.ts` 与 `createBridgeProvider.ts` 两个纯死文件(304 行)。
- 移除三个调用点文件中的死链 import 与调用,保持 provider 当前生产可观察行为不变(`requestRefresh()` 维持"永远发送失败"语义,直接 return false,不改变 loading/retry 状态机时序)。
- 同步更新两个测试文件:移除对已删除模块的 `vi.mock`;slash command 归一化测试改用仍保留的 `__pendingSlashCommands` 注入路径,保留 2026-05-28 白屏修复(archive)确立的 payload 归一化行为覆盖。

## 非目标

- 不删除 `promptProvider.ts` 的 `window.updatePrompts` 注册、`slashCommandProvider.ts` 的 payload handler 与 `__pendingSlashCommands` 处理(不在任务锚点内;其生产死性留待后续提案评估)。
- 不动 `vite-env.d.ts` 的 Window 接口声明(文件域外,遗留报告)。
- 不动 `fileReferenceProvider.ts` / `usePromptEnhancer` 的 `window.sendToJava` 活路径。
- 不做 archive 与全局索引校准(由归档官统一执行)。

## 风险与回滚

- 风险低:所有删除点均已验证无活路径;provider 行为保持现状(perpetual loading fallback 不变)。
- 回滚:`git revert` 单个 commit 即可。

## 验收口径

- `npm run typecheck` 通过。
- 改动文件 `npx eslint` 零新增告警。
- 聚焦 vitest:`slashCommandProvider.test.ts` + `useInputHistory.test.ts` 全绿。
- 全仓 grep 不再存在 `utils/bridge` / `createBridgeProvider` 引用。
