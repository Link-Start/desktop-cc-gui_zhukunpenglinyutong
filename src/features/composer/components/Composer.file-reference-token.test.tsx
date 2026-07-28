/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposerEditorSettings } from "../../../types";
import type {
  CodeAnnotationDraftInput,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import {
  buildCodeAnnotationDedupeKey,
  createCodeAnnotationSelection,
} from "../../code-annotations/utils/codeAnnotations";
import { Composer } from "./Composer";
import {
  getSharedTargetState,
  resetSharedTargetStoreForTests,
  selectNextTarget,
} from "../../shared-session/target/targetStore";
import {
  dispatchSharedSendEvent,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
} from "../../shared-session/runtime/sharedSendStateStore";
import { subscribeProviderContinuationDialogRequests } from "../../threads/services/providerContinuationRequests";

afterEach(() => {
  cleanup();
  resetSharedTargetStoreForTests();
  resetSharedSendStateStoreForTests();
});

beforeEach(() => {
  vi.mocked(invoke).mockReset().mockResolvedValue(null);
});

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

vi.mock("../../engine/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));


vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    text,
    onTextChange,
    onSend,
    providerProfileId,
    selectedEffort,
    onNativeProviderTargetChange,
    onExecutionTargetChange,
    onSelectEngine,
    onSelectModel,
  }: {
    text: string;
    onTextChange: (next: string, cursor: number | null) => void;
    onSend: () => void;
    providerProfileId?: string | null;
    selectedEffort?: string | null;
    onNativeProviderTargetChange?: (target: {
      engine: "codex";
      providerProfileId: string;
      modelCatalogEntryId: string;
      model: string;
      providerProfileNameSnapshot: string;
      providerProfileSource: "managed";
    }) => void;
    onExecutionTargetChange?: (target: {
      engine: "codex";
      providerProfileId: string;
      modelCatalogEntryId: string;
      model: string;
      reasoning: { effort: string };
      providerProfileNameSnapshot: string;
      providerProfileSource: "managed";
    }) => void;
    onSelectEngine?: (engine: "codex") => void;
    onSelectModel?: (modelId: string) => void;
  }) => (
    <>
      <div
        data-testid="composer-target-authority"
        data-atomic-target={String(Boolean(onExecutionTargetChange))}
        data-engine-bypass={String(Boolean(onSelectEngine))}
        data-model-bypass={String(Boolean(onSelectModel))}
      />
      <textarea
        value={text}
        data-provider-profile-id={providerProfileId ?? "null"}
        data-effort={selectedEffort ?? "null"}
        onChange={(event) =>
          onTextChange(event.currentTarget.value, event.currentTarget.value.length)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSend();
          }
        }}
      />
      <button
        type="button"
        data-testid="request-provider-continuation"
        onClick={() =>
          onNativeProviderTargetChange?.({
            engine: "codex",
            providerProfileId: "provider-b",
            modelCatalogEntryId: "settings-reasoning",
            model: "deepseek-v4-pro",
            providerProfileNameSnapshot: "Provider B",
            providerProfileSource: "managed",
          })
        }
      />
      <button
        type="button"
        data-testid="select-shared-target"
        onClick={() =>
          onExecutionTargetChange?.({
            engine: "codex",
            providerProfileId: "provider-b",
            modelCatalogEntryId: "settings-reasoning",
            model: "deepseek-v4-pro",
            reasoning: { effort: "high" },
            providerProfileNameSnapshot: "Provider B",
            providerProfileSource: "managed",
          })
        }
      />
    </>
  ),
}));

function ComposerHarness({
  onSend,
  pendingCodeAnnotation = null,
  onCodeAnnotationConsumed,
  sharedTarget,
}: {
  onSend: (text: string) => void;
  pendingCodeAnnotation?: CodeAnnotationDraftInput | null;
  onCodeAnnotationConsumed?: (dedupeKey: string) => void;
  sharedTarget?: {
    providerProfileId: string;
    model: string;
    runtimeModel?: string;
    effort: string;
  };
}) {
  const [selectedCodeAnnotations, setSelectedCodeAnnotations] = useState<CodeAnnotationSelection[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handleRemoveCodeAnnotation = useCallback((annotationId: string) => {
    setSelectedCodeAnnotations((current) =>
      current.filter((annotation) => annotation.id !== annotationId),
    );
  }, []);
  const handleClearCodeAnnotations = useCallback(() => {
    setSelectedCodeAnnotations([]);
  }, []);
  useEffect(() => {
    if (!pendingCodeAnnotation) {
      return;
    }
    const selection = createCodeAnnotationSelection(pendingCodeAnnotation);
    if (!selection) {
      return;
    }
    setSelectedCodeAnnotations([selection]);
    onCodeAnnotationConsumed?.(buildCodeAnnotationDedupeKey(pendingCodeAnnotation));
  }, [onCodeAnnotationConsumed, pendingCodeAnnotation]);

  const editorSettings: ComposerEditorSettings = {
    preset: "default",
    expandFenceOnSpace: false,
    expandFenceOnEnter: false,
    fenceLanguageTags: false,
    fenceWrapSelection: false,
    autoWrapPasteMultiline: false,
    autoWrapPasteCodeLike: false,
    continueListOnShiftEnter: false,
  };

  return (
    <Composer
      onSend={(text) => onSend(text)}
      onQueue={() => {}}
      onStop={() => {}}
      canStop={false}
      isProcessing={false}
      steerEnabled={false}
      collaborationModes={[]}
      collaborationModesEnabled={true}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      selectedEngine="claude"
      isSharedSession={Boolean(sharedTarget)}
      providerProfileId={sharedTarget?.providerProfileId ?? null}
      models={
        sharedTarget
          ? [
              {
                id: sharedTarget.model,
                displayName: sharedTarget.model,
                model: sharedTarget.runtimeModel ?? sharedTarget.model,
              },
            ]
          : []
      }
      selectedModelId={sharedTarget?.model ?? null}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={sharedTarget?.effort ?? null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={[]}
      prompts={[]}
      commands={[]}
      files={[]}
      textareaRef={textareaRef}
      dictationEnabled={false}
      editorSettings={editorSettings}
      activeWorkspaceId="ws-1"
      activeThreadId="thread-1"
      pendingCodeAnnotation={pendingCodeAnnotation}
      onCodeAnnotationConsumed={onCodeAnnotationConsumed}
      selectedCodeAnnotations={selectedCodeAnnotations}
      onRemoveCodeAnnotation={handleRemoveCodeAnnotation}
      onClearCodeAnnotations={handleClearCodeAnnotations}
    />
  );
}

function getTextarea(container: HTMLElement) {
  const textarea = container.querySelector("textarea");
  if (!textarea) {
    throw new Error("Textarea not found");
  }
  return textarea as HTMLTextAreaElement;
}

describe("Composer file reference token", () => {
  it("does not fabricate a Shared target from global Composer props", () => {
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          runtimeModel: "claude-sonnet-4-5-runtime",
          effort: "high",
        }}
      />,
    );

    expect(
      getSharedTargetState("ws-1", "thread-1").selectedNextTarget,
    ).toBeNull();
    const authority = view.getByTestId("composer-target-authority");
    expect(authority.dataset.atomicTarget).toBe("true");
    expect(authority.dataset.engineBypass).toBe("false");
    expect(authority.dataset.modelBypass).toBe("false");
  });

  it("keeps explicit local Provider and empty reasoning instead of old props", () => {
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          effort: "high",
        }}
      />,
    );

    act(() => {
      selectNextTarget("ws-1", "thread-1", {
        engine: "claude",
        providerProfileId: null,
        modelCatalogEntryId: "claude-opus-4-1",
        model: "claude-opus-4-1",
        reasoning: null,
        providerProfileNameSnapshot: "本地配置",
        providerProfileSource: "disk",
      });
    });

    const textarea = getTextarea(view.container);
    expect(textarea.dataset.providerProfileId).toBe("null");
    expect(textarea.dataset.effort).toBe("null");
  });

  it("persists every Shared picker level without provisioning a binding", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      selectedTarget: {
        engine: "codex",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "settings-reasoning",
        model: "deepseek-v4-pro",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider B",
        providerProfileSource: "managed",
      },
    });
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          effort: "high",
        }}
      />,
    );

    fireEvent.click(view.getByTestId("select-shared-target"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_shared_session_selected_engine", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        selectedEngine: "codex",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "settings-reasoning",
        model: "deepseek-v4-pro",
        reasoningEffort: "high",
        providerProfileNameSnapshot: "Provider B",
        providerProfileSource: "managed",
      });
    });
    expect(getSharedTargetState("ws-1", "thread-1").selectedNextTarget).toEqual({
      engine: "codex",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "settings-reasoning",
      model: "deepseek-v4-pro",
      reasoning: { effort: "high" },
      providerProfileNameSnapshot: "Provider B",
      providerProfileSource: "managed",
    });
  });

  it("keeps the last persisted target when the next picker persistence fails", async () => {
    const previousTarget = {
      engine: "claude" as const,
      providerProfileId: null,
      modelCatalogEntryId: "claude-opus-4-1",
      model: "claude-opus-4-1",
      reasoning: null,
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk" as const,
    };
    selectNextTarget("ws-1", "thread-1", previousTarget);
    dispatchSharedSendEvent("ws-1", "thread-1", { type: "send" });
    dispatchSharedSendEvent(
      "ws-1",
      "thread-1",
      { type: "targetUnavailable" },
      { detail: "provider removed" },
    );
    vi.mocked(invoke).mockRejectedValueOnce(new Error("disk unavailable"));
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          effort: "high",
        }}
      />,
    );

    fireEvent.click(view.getByTestId("select-shared-target"));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(
        getSharedTargetState("ws-1", "thread-1").selectedNextTarget,
      ).toEqual(previousTarget);
    });
    expect(getSharedSendState("ws-1", "thread-1")).toEqual({
      state: "target-unavailable",
      degradedInfo: null,
      detail: "provider removed",
    });
  });

  it("repairs target-unavailable only after backend confirms the exact target", async () => {
    dispatchSharedSendEvent("ws-1", "thread-1", { type: "send" });
    dispatchSharedSendEvent(
      "ws-1",
      "thread-1",
      { type: "targetUnavailable" },
      { detail: "provider removed" },
    );
    vi.mocked(invoke).mockResolvedValueOnce({
      selectedTarget: {
        engine: "codex",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "settings-reasoning",
        model: "deepseek-v4-pro",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider B",
        providerProfileSource: "managed",
      },
    });
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          effort: "high",
        }}
      />,
    );

    fireEvent.click(view.getByTestId("select-shared-target"));

    await waitFor(() => {
      expect(getSharedSendState("ws-1", "thread-1")).toEqual({
        state: "idle",
        degradedInfo: null,
        detail: null,
      });
    });
  });

  it("keeps target-unavailable locked when backend confirms a different target", async () => {
    const previousTarget = {
      engine: "claude" as const,
      providerProfileId: null,
      modelCatalogEntryId: "claude-opus-4-1",
      model: "claude-opus-4-1",
      reasoning: null,
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk" as const,
    };
    selectNextTarget("ws-1", "thread-1", previousTarget);
    dispatchSharedSendEvent("ws-1", "thread-1", { type: "send" });
    dispatchSharedSendEvent(
      "ws-1",
      "thread-1",
      { type: "targetUnavailable" },
      { detail: "provider removed" },
    );
    vi.mocked(invoke).mockResolvedValueOnce({
      selectedTarget: {
        engine: "codex",
        providerProfileId: "provider-c",
        modelCatalogEntryId: "settings-reasoning",
        model: "deepseek-v4-pro",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider C",
        providerProfileSource: "managed",
      },
    });
    const view = render(
      <ComposerHarness
        onSend={() => {}}
        sharedTarget={{
          providerProfileId: "openrouter",
          model: "claude-sonnet-4-5",
          effort: "high",
        }}
      />,
    );

    fireEvent.click(view.getByTestId("select-shared-target"));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(
        getSharedTargetState("ws-1", "thread-1").selectedNextTarget,
      ).toEqual(previousTarget);
    });
    expect(getSharedSendState("ws-1", "thread-1")).toEqual({
      state: "target-unavailable",
      degradedInfo: null,
      detail: "provider removed",
    });
  });

  it("publishes the selected native Provider and Model as a continuation request", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProviderContinuationDialogRequests(listener);
    const view = render(<ComposerHarness onSend={() => {}} />);

    fireEvent.click(
      view.getByTestId("request-provider-continuation"),
    );

    expect(listener).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sourceSessionId: "thread-1",
      destination: {
        engine: "codex",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "settings-reasoning",
        model: "deepseek-v4-pro",
        reasoningEffort: null,
        providerProfileNameSnapshot: "Provider B",
        providerProfileSource: "managed",
        runtimeCapabilityFingerprint: null,
      },
    });
    unsubscribe();
  });

  it("converts visual file tokens to absolute paths before send", async () => {
    const onSend = vi.fn();
    const view = render(<ComposerHarness onSend={onSend} />);
    const textarea = getTextarea(view.container);

    const value =
      "请检查 📁 src-tauri `/Users/demo/repo/src-tauri` 和 📄 App.tsx `/Users/demo/repo/src/App.tsx`";

    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      textarea.focus();
      textarea.setSelectionRange(value.length, value.length);
      fireEvent.select(textarea);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(textarea.value).toBe("请检查 📁 src-tauri 和 📄 App.tsx");

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend).toHaveBeenCalledWith(
      "请检查 /Users/demo/repo/src-tauri 和 /Users/demo/repo/src/App.tsx",
    );
  });

  it("deduplicates repeated references for the same path", async () => {
    const onSend = vi.fn();
    const view = render(<ComposerHarness onSend={onSend} />);
    const textarea = getTextarea(view.container);

    const value =
      "📁 ai-reach `/Users/demo/repo/ai-reach`  📁 ai-reach `/Users/demo/repo/ai-reach`";

    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      textarea.focus();
      textarea.setSelectionRange(value.length, value.length);
      fireEvent.select(textarea);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(textarea.value).toBe("📁 ai-reach  ");

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend).toHaveBeenCalledWith("/Users/demo/repo/ai-reach");
  });

  it("keeps existing visible reference when duplicate token is appended", async () => {
    const onSend = vi.fn();
    const view = render(<ComposerHarness onSend={onSend} />);
    const textarea = getTextarea(view.container);

    const value =
      "📁 ai-reach  📁 ai-reach `/Users/demo/repo/ai-reach`  ";

    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      textarea.focus();
      textarea.setSelectionRange(value.length, value.length);
      fireEvent.select(textarea);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(textarea.value).toBe("📁 ai-reach  ");
  });

  it("keeps one visible label when stale duplicate tokens re-enter text", async () => {
    const onSend = vi.fn();
    const view = render(<ComposerHarness onSend={onSend} />);
    const textarea = getTextarea(view.container);

    const singleToken = "📁 ai-reach `/Users/demo/repo/ai-reach`  ";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: singleToken,
          selectionStart: singleToken.length,
        },
      });
      textarea.focus();
      textarea.setSelectionRange(singleToken.length, singleToken.length);
      fireEvent.select(textarea);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(textarea.value).toBe("📁 ai-reach  ");

    const staleDuplicatedTokens =
      "📁 ai-reach `/Users/demo/repo/ai-reach`  📁 ai-reach `/Users/demo/repo/ai-reach`  ";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: staleDuplicatedTokens,
          selectionStart: staleDuplicatedTokens.length,
        },
      });
      textarea.focus();
      textarea.setSelectionRange(
        staleDuplicatedTokens.length,
        staleDuplicatedTokens.length,
      );
      fireEvent.select(textarea);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(textarea.value).toBe("📁 ai-reach  ");

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend).toHaveBeenCalledWith("/Users/demo/repo/ai-reach");
  });

  it("appends code annotations to the sent prompt", async () => {
    const onSend = vi.fn();
    const onCodeAnnotationConsumed = vi.fn();
    const view = render(
      <ComposerHarness
        onSend={onSend}
        onCodeAnnotationConsumed={onCodeAnnotationConsumed}
        pendingCodeAnnotation={{
          path: "src/App.tsx",
          lineRange: { startLine: 12, endLine: 18 },
          body: "这里需要解释状态为什么丢失",
          source: "file-edit-mode",
        }}
      />,
    );
    const textarea = getTextarea(view.container);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.getByText("App.tsx · L12-L18")).toBeTruthy();
    expect(view.getByText("这里需要解释状态为什么丢失")).toBeTruthy();
    expect(onCodeAnnotationConsumed).toHaveBeenCalledWith(
      "src/App.tsx::12::18::这里需要解释状态为什么丢失",
    );

    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: "请检查",
          selectionStart: 3,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend).toHaveBeenCalledWith(
      "请检查\n\n@file `src/App.tsx#L12-L18`\n标注：这里需要解释状态为什么丢失",
    );
  });
});
