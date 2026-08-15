/** @vitest-environment jsdom */
import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import type { ComposerSendReadiness } from "../utils/composerSendReadiness";

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    onTextChange,
    onSend,
    onManualMemorySelect,
    sendReadiness,
  }: {
    onTextChange: (next: string, cursor: number | null) => void;
    onSend: () => void;
    sendReadiness?: ComposerSendReadiness | null;
    onManualMemorySelect?: (memory: {
      id: string;
      title: string;
      summary: string;
      detail: string;
      kind: string;
      importance: string;
      updatedAt: number;
      tags: string[];
    }) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="fill-text"
        onClick={() => onTextChange("hello", 5)}
      >
        fill
      </button>
      <button
        type="button"
        data-testid="select-manual-memory"
        onClick={() =>
          onManualMemorySelect?.({
            id: "memory-1",
            title: "Known issue",
            summary: "summary",
            detail: "用户输入：Question\n\n助手输出摘要：Answer",
            kind: "known_issue",
            importance: "high",
            updatedAt: 1,
            tags: [],
          })
        }
      >
        memory
      </button>
      <button type="button" data-testid="send-message" onClick={() => onSend()}>
        send
      </button>
      <div data-testid="readiness-context-summary">
        {sendReadiness?.contextSummary.compactLabel ?? ""}
      </div>
    </div>
  ),
}));

function renderComposer(
  onSend = vi.fn(() => Promise.resolve()),
  overrides: Partial<ComponentProps<typeof Composer>> = {},
) {
  return render(
    <Composer
      onSend={onSend}
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
      models={[]}
      selectedModelId={null}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={[]}
      prompts={[]}
      commands={[]}
      files={[]}
      onDraftChange={() => {}}
      activeWorkspaceId="ws-1"
      activeThreadId="thread-1"
      {...overrides}
    />,
  );
}

describe("Composer context selection (ledger surface removed)", () => {
  afterEach(() => {
    cleanup();
  });

  it("summarizes selected memory without context ledger surface", async () => {
    const onSend = vi.fn(() => Promise.resolve());
    const view = renderComposer(onSend);

    await act(async () => {
      fireEvent.click(screen.getByTestId("fill-text"));
      fireEvent.click(screen.getByTestId("select-manual-memory"));
    });

    expect(screen.getByTestId("readiness-context-summary").textContent).toBe(
      "memory:1",
    );
    expect(view.container.querySelector(".composer-context-stack")).toBeTruthy();
    expect(view.container.querySelector(".composer-context-ledger")).toBeNull();
    expect(screen.queryByRole("region", { name: "composer.contextLedgerTitle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "composer.contextLedgerExpand" })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-message"));
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("readiness-context-summary").textContent).toBe(
      "no-extra-context",
    );
  });

  it("idempotently adds an externally requested note to the existing context selection", async () => {
    const noteCard = {
      id: "note-1",
      title: "发布清单",
      plainTextExcerpt: "先构建再发布",
      bodyMarkdown: "# 发布清单",
      updatedAt: 1,
      archived: false,
      imageCount: 0,
      previewAttachments: [],
    };

    renderComposer(undefined, {
      externalNoteCardSelectionRequest: {
        requestId: 1,
        noteCard,
      },
    });

    await act(async () => Promise.resolve());
    expect(screen.getByText("发布清单")).toBeTruthy();
    expect(screen.getByText("composer.noteCardSelectionHint")).toBeTruthy();
  });
});
