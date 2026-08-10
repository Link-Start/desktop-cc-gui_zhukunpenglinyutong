// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useThreadMessaging } from "./useThreadMessaging";
import { sendUserMessage } from "../../../services/tauri";
import { projectMemoryFacade } from "../../project-memory/services/projectMemoryFacade";
import * as memoryPickGateStore from "../../project-memory/memoryPick/memoryPickGateStore";
import {
  __resetMemoryPickGateStoreForTests,
  confirmMemoryPickGate,
  dismissMemoryPickGate,
  getMemoryPickGateSnapshot,
  setMemoryPickGateSelectedIds,
  skipMemoryPickGate,
} from "../../project-memory/memoryPick/memoryPickGateStore";
import {
  __resetMemoryPickSessionStoreForTests,
  getMemoryPickSessionPolicy,
  markMemoryPickFirstPickDone,
  resetMemoryPickSessionPolicy,
  setMemoryPickComposerMode,
} from "../../project-memory/memoryPick/memoryPickSessionStore";

vi.mock("@sentry/react", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("./useReviewPrompt", () => ({
  useReviewPrompt: () => ({
    reviewPrompt: null,
    openReviewPrompt: vi.fn(),
    closeReviewPrompt: vi.fn(),
    showPresetStep: false,
    choosePreset: vi.fn(),
    highlightedPresetIndex: -1,
    setHighlightedPresetIndex: vi.fn(),
    highlightedBranchIndex: -1,
    setHighlightedBranchIndex: vi.fn(),
    highlightedCommitIndex: -1,
    setHighlightedCommitIndex: vi.fn(),
    handleReviewPromptKeyDown: vi.fn(),
    confirmBranch: vi.fn(),
    selectBranch: vi.fn(),
    selectBranchAtIndex: vi.fn(),
    selectCommit: vi.fn(),
    selectCommitAtIndex: vi.fn(),
    confirmCommit: vi.fn(),
    updateCustomInstructions: vi.fn(),
  }),
}));

vi.mock("../../../services/tauri", () => ({
  sendUserMessage: vi.fn(),
  startReview: vi.fn(),
  interruptTurn: vi.fn(),
  listMcpServerStatus: vi.fn(),
  engineSendMessage: vi.fn(),
  engineInterruptTurn: vi.fn(),
  engineInterrupt: vi.fn(),
  projectMemoryCaptureAuto: vi.fn(async () => null),
  listGeminiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  listKimiSessions: vi.fn(),
}));

vi.mock("../../project-memory/services/projectMemoryFacade", () => ({
  projectMemoryFacade: {
    list: vi.fn(),
    listSummary: vi.fn(),
    get: vi.fn(),
    captureTurnInput: vi.fn(async () => null),
  },
}));

vi.mock("../../note-cards/services/noteCardsFacade", () => ({
  noteCardsFacade: { get: vi.fn() },
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "ws",
  path: "/tmp/ws",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const THREAD = "thread-1";

function memoryItem(id: string, title: string, summary: string) {
  return {
    id,
    workspaceId: workspace.id,
    kind: "note",
    recordKind: "note",
    title,
    summary,
    detail: summary,
    cleanText: summary,
    rawText: summary,
    tags: ["tag"],
    importance: "high",
    source: "manual",
    fingerprint: id,
    createdAt: 1,
    updatedAt: 2,
  };
}

function buildHook() {
  return renderHook(() =>
    useThreadMessaging({
      activeWorkspace: workspace,
      activeThreadId: THREAD,
      steerEnabled: false,
      customPrompts: [],
      activeEngine: "codex",
      threadStatusById: {},
      itemsByThread: {},
      activeTurnIdByThread: {},
      codexAcceptedTurnByThread: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      pendingInterruptsRef: { current: new Map() },
      interruptedThreadsRef: { current: new Map() },
      dispatch: vi.fn(),
      getCustomName: vi.fn(),
      getThreadEngine: vi.fn(() => "codex"),
      markProcessing: vi.fn(),
      markReviewing: vi.fn(),
      setActiveTurnId: vi.fn(),
      recordThreadActivity: vi.fn(),
      safeMessageActivity: vi.fn(),
      onDebug: vi.fn(),
      pushThreadErrorMessage: vi.fn(),
      ensureThreadForActiveWorkspace: vi.fn(),
      ensureThreadForWorkspace: vi.fn(),
      refreshThread: vi.fn(),
      forkThreadForWorkspace: vi.fn(),
      updateThreadParent: vi.fn(),
      startThreadForWorkspace: vi.fn(),
      onInputMemoryCaptured: vi.fn(),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  __resetMemoryPickGateStoreForTests();
  __resetMemoryPickSessionStoreForTests();
  resetMemoryPickSessionPolicy(workspace.id, THREAD, "off");
  vi.mocked(sendUserMessage).mockResolvedValue({
    result: { turn: { id: "turn-1" } },
  } as never);
  vi.mocked(projectMemoryFacade.listSummary).mockResolvedValue({
    items: [
      memoryItem("m-db", "数据库连接池", "超时与连接上限"),
      memoryItem("m-ui", "UI 主题", "暗色模式"),
      memoryItem("m-idx", "数据库索引", "慢查询"),
    ],
    total: 3,
  } as never);
  vi.mocked(projectMemoryFacade.get).mockImplementation(async (id: string) => {
    const map: Record<string, ReturnType<typeof memoryItem>> = {
      "m-db": memoryItem("m-db", "数据库连接池", "超时与连接上限"),
      "m-ui": memoryItem("m-ui", "UI 主题", "暗色模式"),
      "m-idx": memoryItem("m-idx", "数据库索引", "慢查询"),
    };
    return (map[id] ?? null) as never;
  });
});

afterEach(() => {
  __resetMemoryPickGateStoreForTests();
  __resetMemoryPickSessionStoreForTests();
});

describe("useThreadMessaging memory pick gate", () => {
  it("first pick blocks send until confirm, then injects memory-pick pack", async () => {
    const { result } = buildHook();

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时怎么办",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });

    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
        "awaiting-choice",
      );
    });
    expect(sendUserMessage).not.toHaveBeenCalled();

    setMemoryPickGateSelectedIds(workspace.id, THREAD, ["m-db"]);
    confirmMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await sendPromise;
    });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toContain('source="memory-pick"');
    expect(textArg).toContain("数据库连接池");
    expect(textArg).toContain("数据库 超时怎么办");
    expect(
      getMemoryPickSessionPolicy(workspace.id, THREAD).firstPickRequired,
    ).toBe(false);
  });

  it("pick mode skip sends plain text without memory-pick pack", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");

    const { result } = buildHook();
    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时 怎么办",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    skipMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await sendPromise;
    });

    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toBe("数据库 超时 怎么办");
    expect(textArg).not.toContain("memory-pick");
  });

  it("after first-pick skip, session sticks to pick so next send still opens gate", async () => {
    const { result } = buildHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });
    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    skipMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await first;
    });
    expect(getMemoryPickSessionPolicy(workspace.id, THREAD).composerMode).toBe(
      "pick",
    );

    vi.mocked(sendUserMessage).mockClear();
    let second!: Promise<unknown>;
    act(() => {
      second = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 索引 优化",
        [],
        // Composer 可能仍短暂传 off；session pick 不得被覆盖
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });
    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    expect(sendUserMessage).not.toHaveBeenCalled();
    skipMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await second;
    });
  });

  it("dismiss suppresses later gates in the same session", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");

    const { result } = buildHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "第一次",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeTruthy();
    });
    dismissMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await first;
    });
    expect(getMemoryPickSessionPolicy(workspace.id, THREAD).dismissed).toBe(
      true,
    );

    vi.mocked(sendUserMessage).mockClear();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "第二次应跳过闸门",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });
    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe(
      "第二次应跳过闸门",
    );
  });

  it("always mode opens pick gate (not silent) after first pick", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "always");
    const openSpy = vi
      .spyOn(memoryPickGateStore, "openMemoryPickGate")
      .mockResolvedValue({
        action: "confirm",
        selectedIds: ["m-db", "m-idx", "m-ui"],
        mode: "always",
      });

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库连接池 超时",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "always" },
      );
    });

    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls[0]?.[0]?.mode).toBe("always");
    expect(openSpy.mock.calls[0]?.[0]?.firstPick).toBe(false);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toContain('source="memory-pick"');
    openSpy.mockRestore();
  });

  it("empty memory list auto-passes without pick UI", async () => {
    vi.mocked(projectMemoryFacade.listSummary).mockResolvedValue({
      items: [],
      total: 0,
    } as never);

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "无记忆时直发",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe("无记忆时直发");
  });

  it("off mode without first pick does not open gate", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "off");

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "plain",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe("plain");
  });
});
