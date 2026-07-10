// @vitest-environment jsdom
//
// A4 live-text 外部化 + 分段交错的回归守卫。
//
// liveTextExternalization 开启后，一段正文里只有「建壳首 delta」会落进 reducer，
// 其余都停在 liveAssistantTextChannel。工具开始时前端会 incrementAgentSegment，
// 后续正文改落新的 assistant item——若不在分段前把通道尾段灌回，本段正文会被
// 下一段的首 delta 顶掉而永久丢失，界面表现为「整轮正文挤成一坨排在所有工具之前」。
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildConversationItem } from "../../../utils/threadItems";
import { resetLiveAssistantTextChannelForTests } from "../utils/liveAssistantTextChannel";
import { useThreadItemEvents } from "./useThreadItemEvents";

vi.mock("../../../utils/threadItems", () => ({
  buildConversationItem: vi.fn(),
}));

// 该 flag 的 testDefaultValue 为 false；本文件专门验证它开启后的行为。
// useThreadItemEvents 在模块加载时读取一次，故必须在 import 前用 mock 覆盖。
vi.mock("../utils/realtimePerfFlags", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../utils/realtimePerfFlags")
  >();
  return { ...actual, isLiveTextExternalizationEnabled: () => true };
});

const THREAD_ID = "claude:session-1";
const WORKSPACE_ID = "ws-1";
const ITEM_ID = "claude-item-1";

const makeHook = () => {
  const dispatch = vi.fn();
  const { result } = renderHook(() =>
    useThreadItemEvents({
      activeThreadId: THREAD_ID,
      dispatch,
      getCustomName: vi.fn(() => undefined),
      markProcessing: vi.fn(),
      markReviewing: vi.fn(),
      safeMessageActivity: vi.fn(),
      recordThreadActivity: vi.fn(),
      applyCollabThreadLinks: vi.fn(),
      interruptedThreadsRef: { current: new Map<string, Map<string, true>>() },
    }),
  );
  return { result, dispatch };
};

const agentDeltaCalls = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls
    .map(([action]) => action as Record<string, unknown>)
    .filter((action) => action.type === "appendAgentDelta");

const dispatchedTypes = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.map(([action]) => (action as { type: string }).type);

describe("useThreadItemEvents live-text segmentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("ccgui.perf.realtimeBatching");
    resetLiveAssistantTextChannelForTests();
    vi.mocked(buildConversationItem).mockReturnValue({
      id: "tool-1",
      kind: "tool",
    } as unknown as ReturnType<typeof buildConversationItem>);
  });

  it("drains the live-text tail into the current segment before a tool boundary", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      // 首 delta 建壳 → 落 reducer。
      result.current.onAgentMessageDelta({
        workspaceId: WORKSPACE_ID,
        threadId: THREAD_ID,
        itemId: ITEM_ID,
        delta: "Let me check the mount point.",
      });
      // 后续 delta 只进通道，不落 reducer。
      result.current.onAgentMessageDelta({
        workspaceId: WORKSPACE_ID,
        threadId: THREAD_ID,
        itemId: ITEM_ID,
        delta: " Searching now.",
      });
    });

    expect(agentDeltaCalls(dispatch).map((action) => action.delta)).toEqual([
      "Let me check the mount point.",
    ]);

    act(() => {
      result.current.onItemStarted(WORKSPACE_ID, THREAD_ID, {
        type: "commandExecution",
        id: "tool-1",
      });
    });

    // 尾段被灌回同一个 itemId（reducer 会用「旧 segment」解析出本段的 item）。
    expect(agentDeltaCalls(dispatch)).toEqual([
      expect.objectContaining({ itemId: ITEM_ID, delta: "Let me check the mount point." }),
      expect.objectContaining({
        itemId: ITEM_ID,
        delta: " Searching now.",
        hasCustomName: true,
      }),
    ]);

    // 且灌回必须严格早于 incrementAgentSegment，否则会落到下一段的 item 上。
    const types = dispatchedTypes(dispatch);
    const drainIndex = types.lastIndexOf("appendAgentDelta");
    const incrementIndex = types.indexOf("incrementAgentSegment");
    expect(incrementIndex).toBeGreaterThan(-1);
    expect(drainIndex).toBeLessThan(incrementIndex);
  });

  it("starts a fresh shell for the text that follows the tool", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onAgentMessageDelta({
        workspaceId: WORKSPACE_ID,
        threadId: THREAD_ID,
        itemId: ITEM_ID,
        delta: "before tool",
      });
      result.current.onItemStarted(WORKSPACE_ID, THREAD_ID, {
        type: "commandExecution",
        id: "tool-1",
      });
      // 通道已在分段时清空 → 这条 delta 重新建壳（isFirst），落进新 segment 的 item。
      result.current.onAgentMessageDelta({
        workspaceId: WORKSPACE_ID,
        threadId: THREAD_ID,
        itemId: ITEM_ID,
        delta: "after tool",
      });
    });

    const deltas = agentDeltaCalls(dispatch).map((action) => action.delta);
    expect(deltas).toEqual(["before tool", "after tool"]);

    const types = dispatchedTypes(dispatch);
    expect(types.indexOf("incrementAgentSegment")).toBeLessThan(
      types.lastIndexOf("appendAgentDelta"),
    );
  });
});
