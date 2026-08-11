import { useEffect, useState, type ReactNode } from "react";
import {
  ensureInteractiveInputHooks,
  getLastInteractiveInputAtMs,
  hadRecentInteractiveInput,
} from "../../../utils/interactiveMainThread";
import { ChatInputBox } from "./ChatInputBox/ChatInputBox";

/**
 * 冷启假死二分（2026-08-11）根因：完整 `Composer.tsx` 挂载后猛点必卡；
 * ChatInputBox / Adapter 不卡。
 *
 * v1 失败：把「无输入」当 quiet → 冷启几百 ms 误升级。
 * v2 失败：4s 无人操作仍自动升级 → UI 出现后一点就卡。
 *
 * v3：
 * - 默认永远轻量 ChatInputBox，直到「挂载后有过指针输入 + 安静 ≥1.5s」
 * - **禁止**无输入自动升级（避免「界面出来后一点就卡」）
 * - renderFull 仅在 ready 后调用，不预创建 Composer 树
 * - 轻量壳 onSubmit 可转发真实发送
 */
export function DeferredComposerMount({
  renderFull,
  onLightSubmit,
  placeholder = "输入消息，或 @ 引用、$ 技能、# 智能体",
}: {
  renderFull: () => ReactNode;
  onLightSubmit?: (text: string) => void | Promise<void>;
  placeholder?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureInteractiveInputHooks();
    const mountedAt = Date.now();
    let cancelled = false;
    let timerId: number | null = null;

    const tick = () => {
      if (cancelled || ready) {
        return;
      }
      const now = Date.now();
      const lastInput = getLastInteractiveInputAtMs();
      const elapsed = now - mountedAt;
      const hadInputSinceMount = lastInput >= mountedAt;
      const quietFor = now - lastInput;

      // 必须：挂载后真的点过，并且停手够久
      if (hadInputSinceMount && quietFor >= 1_500 && elapsed >= 1_200) {
        if (hadRecentInteractiveInput(250)) {
          timerId = window.setTimeout(tick, 150);
          return;
        }
        setReady(true);
        return;
      }

      // 不再做「无人操作自动升级」——那是 v2 复现点
      timerId = window.setTimeout(tick, 120);
    };

    timerId = window.setTimeout(tick, 500);
    return () => {
      cancelled = true;
      if (timerId != null) {
        window.clearTimeout(timerId);
      }
    };
  }, [ready]);

  if (ready) {
    return <>{renderFull()}</>;
  }

  return (
    <div data-testid="deferred-composer-shell">
      <ChatInputBox
        placeholder={placeholder}
        disabled={false}
        isLoading={false}
        onSubmit={async (text) => {
          const trimmed = (text ?? "").trim();
          if (!trimmed) {
            return;
          }
          await onLightSubmit?.(trimmed);
        }}
      />
    </div>
  );
}
