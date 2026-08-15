// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  APP_SHELL_DOMAIN_CONTEXT_NAMES,
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
} from "./appShellDomainContexts";
import { useAppShellDomainAssembly } from "./useAppShellDomainAssembly";

/**
 * S4 PR-E：Git 表面按 appMode 条件装配（懒装配 + 引用稳定）。
 * 非 git 表面模式（extensions）下 gitSurface bag 冻结：
 * 后台 git 更新不再扇出；切回 chat/gitHistory 时新值即刻生效。
 */

function buildSource(appMode: string): Record<string, unknown> {
  const source: Record<string, unknown> = {
    appMode,
    runtimeThreadBoundary: { kind: "runtime-thread-boundary" },
    runtimeRunState: { phase: "idle" },
    effectiveReasoningOptions: [],
    effectiveSelectedEffort: null,
    handleSelectComposerEffort: () => {},
  };
  for (const domainName of APP_SHELL_DOMAIN_CONTEXT_NAMES) {
    for (const key of APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName]) {
      if (source[key] === undefined) {
        source[key] = `owned:${domainName}:${key}`;
      }
    }
  }
  source.appMode = appMode;
  return source;
}

describe("useAppShellDomainAssembly git surface gating (S4 PR-E)", () => {
  it("chat 模式下 gitSurface 正常装配并随源更新", () => {
    const { result, rerender } = renderHook(
      ({ source }) => useAppShellDomainAssembly(source),
      { initialProps: { source: buildSource("chat") } },
    );
    const first = result.current.gitSurfaceContext;

    rerender({ source: { ...buildSource("chat"), gitStatus: { dirty: 1 } } });
    expect(result.current.gitSurfaceContext).not.toBe(first);
    expect(result.current.gitSurfaceContext.gitStatus).toEqual({ dirty: 1 });
  });

  it("extensions 模式下冻结 gitSurface bag：git 源更新不换引用、不扇出", () => {
    const { result, rerender } = renderHook(
      ({ source }) => useAppShellDomainAssembly(source),
      { initialProps: { source: buildSource("chat") } },
    );
    // 切到 extensions：gitSurface 保持既有 bag
    rerender({ source: buildSource("extensions") });
    const frozen = result.current.gitSurfaceContext;

    // 后台 git 更新（如 extensions 表面下 status 刷新）
    const nextSource = {
      ...buildSource("extensions"),
      gitStatus: { dirty: 2 },
      gitLogTotal: 99,
      // 非 git 域仍正常更新
      settingsOpen: true,
    };
    rerender({ source: nextSource });
    expect(result.current.gitSurfaceContext).toBe(frozen);
    expect(result.current.gitSurfaceContext.gitStatus).not.toEqual({
      dirty: 2,
    });
    // 冻结只针对 gitSurface：其它域照常装配更新
    expect(result.current.settingsContext.settingsOpen).toBe(true);
  });

  it("extensions → chat 切回后 gitSurface 恢复装配，新值即刻生效", () => {
    const { result, rerender } = renderHook(
      ({ source }) => useAppShellDomainAssembly(source),
      { initialProps: { source: buildSource("chat") } },
    );
    rerender({
      source: { ...buildSource("extensions"), gitStatus: { dirty: 3 } },
    });
    expect(result.current.gitSurfaceContext.gitStatus).not.toEqual({
      dirty: 3,
    });

    rerender({
      source: { ...buildSource("chat"), gitStatus: { dirty: 3 } },
    });
    expect(result.current.gitSurfaceContext.gitStatus).toEqual({ dirty: 3 });
  });

  it("首帧即为非 git 表面模式时先完整装配一次（无旧 bag 可用）", () => {
    const { result } = renderHook(
      ({ source }) => useAppShellDomainAssembly(source),
      { initialProps: { source: buildSource("extensions") } },
    );
    expect(result.current.gitSurfaceContext.gitStatus).toBe(
      "owned:gitSurfaceContext:gitStatus",
    );
  });
});
