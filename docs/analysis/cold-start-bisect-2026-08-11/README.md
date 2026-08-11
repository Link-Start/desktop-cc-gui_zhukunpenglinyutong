# 冷启假死二分 · 证据包 2026-08-11

| 项 | 路径 |
|----|------|
| 主记录（过程+清单） | [`../cold-start-action-bisect-checklist-2026-08-11.md`](../cold-start-action-bisect-checklist-2026-08-11.md) |
| 截图 | [`./screenshots/`](./screenshots/) |
| 开关代码 | `src/features/startup-orchestration/utils/coldStartBisectFlags.ts` |

## 结论摘要（最终）

1. **根因**：冷启/Cmd+R 时立即挂载完整 `Composer.tsx`（~3.7k 行 + 多 store 订阅），与早期点击撞主线程 → 假死。  
2. **非根因**：WebView、AppLayout 骨架、真 Sidebar/Messages、ChatInputBox、Adapter、composition hooks 单独均不卡。  
3. **修复**：`DeferredComposerMount`（v3）— 先挂轻量 `ChatInputBox`（可发送），用户停手后再 `renderFull()` 完整 Composer。  
4. **验证**：步21 essentials 不卡；**步22 Mac 生产形态全程不卡**（仅数秒轻量→完整输入框过渡）。  
5. **bisect 档位**默认 `off`；修复代码保留在生产路径 `useLayoutNodes`。  
6. **体验说明**：初始化几秒内输入框为轻量形态，停手后升级完整 Composer——属预期过渡，不是卡死。  

## 截图命名

`step-NN-<tier>-ok|freeze.ext` 或 `00-user-feedback-*.ext`
