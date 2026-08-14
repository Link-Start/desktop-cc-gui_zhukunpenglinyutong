import { describe, expect, it } from "vitest";
import {
  APP_SHELL_DOMAIN_CONTEXT_NAMES,
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
  reuseStableAppShellDomainContexts,
} from "./appShellDomainContexts";
import { assembleAppShellDomainContexts } from "./useAppShellDomainAssembly";

function buildMinimalAssemblySource(): Record<string, unknown> {
  const source: Record<string, unknown> = {
    runtimeActions: { handleToggleRuntimeConsole: () => {} },
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

  // modelSelection rename sources
  source.effectiveModels = ["m1"];
  source.effectiveReasoningSupported = true;
  source.effectiveSelectedModel = "m1";
  source.effectiveSelectedModelId = "m1";
  source.providerModelCatalogs = {};
  source.refreshEngineModels = () => {};
  source.resolvedEffort = null;
  source.resolvedModel = "m1";
  source.setSelectedModelId = () => {};

  // collaboration minimal
  source.applySelectedCollaborationMode = () => {};
  source.collaborationModePayload = null;
  source.collaborationModes = [];
  source.collaborationModesEnabled = false;
  source.collaborationRuntimeModeByThread = {};
  source.collaborationUiModeByThread = {};
  source.handleCollaborationModeResolved = () => {};
  source.resolveCollaborationRuntimeMode = () => null;
  source.resolveCollaborationUiMode = () => null;
  source.selectedCollaborationMode = null;
  source.selectedCollaborationModeId = null;
  source.setCodexCollaborationMode = () => {};
  source.setCollaborationRuntimeModeByThread = () => {};
  source.setCollaborationUiModeByThread = () => {};
  source.setSelectedCollaborationModeId = () => {};

  return source;
}

describe("assembleAppShellDomainContexts", () => {
  it("defines all domains and keeps runtimeThread hot fields out of navigation", () => {
    const contexts = assembleAppShellDomainContexts(buildMinimalAssemblySource());

    expect(Object.keys(contexts).sort()).toEqual(
      [...APP_SHELL_DOMAIN_CONTEXT_NAMES].sort(),
    );
    expect(contexts.runtimeThreadContext.isProcessing).toBe(
      "owned:runtimeThreadContext:isProcessing",
    );
    expect(contexts.runtimeThreadContext.activeItems).toBe(
      "owned:runtimeThreadContext:activeItems",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "isProcessing",
    );
    expect(contexts.sessionIdentityContext.activeWorkspaceId).toBe(
      "owned:sessionIdentityContext:activeWorkspaceId",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "activeWorkspaceId",
    );
    expect(contexts.workspaceCatalogContext.addWorkspace).toBe(
      "owned:workspaceCatalogContext:addWorkspace",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "addWorkspace",
    );
    expect(contexts.gitSurfaceContext.gitStatus).toBe(
      "owned:gitSurfaceContext:gitStatus",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "gitStatus",
    );
    expect(contexts.modeRoutingContext.appMode).toBe(
      "owned:modeRoutingContext:appMode",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "appMode",
    );
    expect(contexts.accountSurfaceContext.activeAccount).toBe(
      "owned:accountSurfaceContext:activeAccount",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "activeAccount",
    );
    expect(contexts.dictationSurfaceContext.dictationState).toBe(
      "owned:dictationSurfaceContext:dictationState",
    );
    expect(contexts.workspaceNavigationContext).not.toHaveProperty(
      "dictationState",
    );
    expect(
      Object.keys(contexts.workspaceNavigationContext).length,
    ).toBeLessThanOrEqual(80);
    expect(contexts.runtimeContext.runtimeRunState).toEqual({ phase: "idle" });
    expect(contexts.modelSelectionContext.selectedModelId).toBe("m1");
    expect(contexts.modelSelectionContext.reasoningOptions).toEqual([]);
  });

  it("S4 PR-D：turn 级 conversation bags 归 runtimeThreadContext，不进 settings/layout", () => {
    const contexts = assembleAppShellDomainContexts(buildMinimalAssemblySource());

    const movedKeys = [
      "historyLoadingByThreadId",
      "historyLoadingProgressByThreadId",
      "historyRestoredAtMsByThread",
      "threadListCursorByWorkspace",
      "threadListPagingByWorkspace",
      "threadParentById",
    ] as const;
    for (const key of movedKeys) {
      expect(contexts.runtimeThreadContext[key]).toBe(
        `owned:runtimeThreadContext:${key}`,
      );
      expect(contexts.settingsContext).not.toHaveProperty(key);
      expect(contexts.layoutContext).not.toHaveProperty(key);
      expect(contexts.workspaceNavigationContext).not.toHaveProperty(key);
    }

    // 无 bag 读者的 turn 级 bags 已从根 bag 移除
    for (const key of [
      "tokenUsageByThread",
      "rateLimitsByWorkspace",
      "planByThread",
      "lastAgentMessageByThread",
    ]) {
      expect(contexts.settingsContext).not.toHaveProperty(key);
      expect(contexts.layoutContext).not.toHaveProperty(key);
      expect(contexts.runtimeThreadContext).not.toHaveProperty(key);
    }

    // sections/render 仍可读：留在 settingsContext 的 conversation keys
    for (const key of [
      "threadsByWorkspace",
      "threadStatusById",
      "threadItemsByThread",
      "threadListLoadingByWorkspace",
    ]) {
      expect(contexts.settingsContext).toHaveProperty(key);
    }
  });

  it("S4 PR-D：turn 级 conversation bags 更新不再打坏 settings/layout 引用", () => {
    const source = buildMinimalAssemblySource();
    const previous = assembleAppShellDomainContexts(source);
    const next = assembleAppShellDomainContexts({
      ...source,
      historyLoadingByThreadId: { "thread-1": true },
      historyLoadingProgressByThreadId: { "thread-1": 0.5 },
      historyRestoredAtMsByThread: { "thread-1": 123 },
      threadListCursorByWorkspace: { "ws-1": "cursor" },
      threadListPagingByWorkspace: { "ws-1": true },
      threadParentById: { "thread-1": "parent" },
    });

    const stable = reuseStableAppShellDomainContexts(previous, next);
    // 迁移后这些 bags 只敲 runtimeThread 域：settings/layout 浅比较通过、引用复用
    expect(stable.settingsContext).toBe(previous.settingsContext);
    expect(stable.layoutContext).toBe(previous.layoutContext);
    expect(stable.workspaceNavigationContext).toBe(
      previous.workspaceNavigationContext,
    );
    // runtimeThread 域确实感知更新
    expect(stable.runtimeThreadContext).toBe(next.runtimeThreadContext);
    expect(stable.runtimeThreadContext.historyLoadingByThreadId).toEqual({
      "thread-1": true,
    });
  });
});
