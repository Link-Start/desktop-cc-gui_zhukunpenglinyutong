// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { writeClientStoreValue, getClientStoreSync } from "../../../services/clientStorage";
import { deleteSessionRadarHistoryEntries } from "../utils/sessionRadarHistoryManagement";
import {
  RADAR_STORE_NAME,
  SESSION_RADAR_COLLAPSED_DATE_GROUPS_KEY,
  SESSION_RADAR_HISTORY_UPDATED_EVENT,
  SESSION_RADAR_READ_STATE_KEY,
} from "../utils/sessionRadarPersistence";
import { WorkspaceSessionRadarPanel } from "./WorkspaceSessionRadarPanel";

// 保留真实实现,仅让 deleteSessionRadarHistoryEntries 可注入失败结果
vi.mock("../utils/sessionRadarHistoryManagement", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../utils/sessionRadarHistoryManagement")>();
  return {
    ...original,
    deleteSessionRadarHistoryEntries: vi.fn(original.deleteSessionRadarHistoryEntries),
  };
});

// 完成条目按测试机"本地日期"分组(formatDateKey),固定 epoch 毫秒会随时区漂移
// (曾在 UTC-7 下 1970-01-01T00:00:00.005Z 落进本地 1969-12-31 而挂测)。
// 用本地时间构造时间戳,分组键在任何时区下都稳定。
const DAY_ONE = new Date(2026, 4, 20, 10, 0, 0).getTime();
const DAY_TWO = new Date(2026, 4, 21, 10, 0, 0).getTime();
const DAY_ONE_KEY = "2026-05-20";
const DAY_TWO_KEY = "2026-05-21";
const DAY_FIVE = new Date(2026, 4, 23, 10, 0, 0).getTime();
const DAY_SIX = new Date(2026, 4, 24, 10, 0, 0).getTime();
const DAY_FIVE_KEY = "2026-05-23";
const DAY_SIX_KEY = "2026-05-24";
const DAY_SEVEN = new Date(2026, 4, 25, 10, 0, 0).getTime();
const DAY_EIGHT = new Date(2026, 4, 26, 10, 0, 0).getTime();
const DAY_NINE = new Date(2026, 4, 27, 10, 0, 0).getTime();

describe("WorkspaceSessionRadarPanel", () => {
  it("loads session-activity styles because the activity panel kill-switch no longer does", () => {
    // session-activity.css 随 P1-1 改成 feature loader；activity 面板被关掉后
    // 雷达是唯一挂载面。test mode 下 hook 不真调 loader，用源码契约锁住接线。
    const panelSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/session-activity/components/WorkspaceSessionRadarPanel.tsx",
      ),
      "utf8",
    );
    expect(panelSource).toContain("loadSessionActivityStyles");
    expect(panelSource).toContain("useFeatureStylesReady");
    expect(panelSource).toContain("if (!stylesReady)");
  });

  it("renders radar entries and toggles preview by click", () => {
    const onSelectThread = vi.fn();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[
          {
            id: "w1:t1",
            workspaceId: "w1",
            workspaceName: "Workspace 1",
            threadId: "t1",
            threadName: "Running Thread",
            engine: "CODEX",
            preview: "running preview",
            updatedAt: 10,
            isProcessing: true,
            startedAt: 5,
            completedAt: null,
            durationMs: 5000,
          },
        ]}
        recentCompletedSessions={[
          {
            id: "w2:t2",
            workspaceId: "w2",
            workspaceName: "Workspace 2",
            threadId: "t2",
            threadName: "Recent Thread",
            engine: "CLAUDE",
            preview: "recent preview",
            updatedAt: DAY_ONE + 5_000,
            isProcessing: false,
            startedAt: DAY_ONE + 1_000,
            completedAt: DAY_ONE + 5_000,
            durationMs: 4000,
          },
          {
            id: "w2:t3",
            workspaceId: "w2",
            workspaceName: "Workspace 2",
            threadId: "t3",
            threadName: "Recent Thread 2",
            engine: "CLAUDE",
            preview: "recent preview 2",
            updatedAt: DAY_ONE + 6_000,
            isProcessing: false,
            startedAt: DAY_ONE + 2_000,
            completedAt: DAY_ONE + 6_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const dateGroupToggle = screen.getByRole("button", { name: new RegExp(DAY_ONE_KEY) });
    expect(dateGroupToggle).toBeTruthy();
    // 唯一(最新)日期组默认展开
    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(dateGroupToggle).getByText("2")).toBeTruthy();
    const runningRow = screen.getByRole("button", { name: /Running Thread/i });
    expect(runningRow.classList.contains("is-preview-expanded")).toBe(false);
    fireEvent.click(runningRow);
    expect(runningRow.classList.contains("is-preview-expanded")).toBe(true);
    expect(onSelectThread).toHaveBeenCalledWith("w1", "t1");
    fireEvent.click(runningRow);
    expect(runningRow.classList.contains("is-preview-expanded")).toBe(false);

    const recentRow = screen.getByRole("button", { name: /^Recent Thread$/i });
    expect(screen.getAllByLabelText("activityPanel.radar.unreadMark")).toHaveLength(2);
    expect(screen.queryByText("activityPanel.radar.openSession")).toBeNull();
    // 未读条目同样展示删除按钮
    expect(view.container.querySelectorAll(".session-activity-radar-delete-button")).toHaveLength(2);

    expect(recentRow.classList.contains("is-preview-expanded")).toBe(false);
    fireEvent.click(recentRow);
    expect(recentRow.classList.contains("is-preview-expanded")).toBe(true);
    expect(onSelectThread).toHaveBeenCalledWith("w2", "t2");
    expect(screen.getAllByLabelText("activityPanel.radar.unreadMark")).toHaveLength(1);
    expect(screen.getByLabelText("activityPanel.radar.readMark")).toBeTruthy();
    expect(view.container.querySelectorAll(".session-activity-radar-delete-button")).toHaveLength(2);
    fireEvent.click(recentRow);
    expect(recentRow.classList.contains("is-preview-expanded")).toBe(false);

    fireEvent.click(dateGroupToggle);
    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Recent Thread 2/i })).toBeNull();
  });

  it("keeps thread navigation while toggling preview expansion", () => {
    const onSelectThread = vi.fn();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w2:t2",
            workspaceId: "w2",
            workspaceName: "Workspace 2",
            threadId: "t2",
            threadName: "Recent Thread",
            engine: "CLAUDE",
            preview: "recent preview",
            updatedAt: DAY_ONE + 5_000,
            isProcessing: false,
            startedAt: DAY_ONE + 1_000,
            completedAt: DAY_ONE + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const dateGroupToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_ONE_KEY) });
    if (!within(view.container).queryByRole("button", { name: /^Recent Thread$/i })) {
      fireEvent.click(dateGroupToggle);
    }
    const recentRow = within(view.container).getByRole("button", { name: /^Recent Thread$/i });

    expect(recentRow.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(recentRow);
    expect(recentRow.getAttribute("aria-expanded")).toBe("true");
    expect(onSelectThread).toHaveBeenNthCalledWith(1, "w2", "t2");

    fireEvent.click(recentRow);
    expect(recentRow.getAttribute("aria-expanded")).toBe("false");
    expect(onSelectThread).toHaveBeenNthCalledWith(2, "w2", "t2");
    expect(onSelectThread).toHaveBeenCalledTimes(2);
  });

  it("opens session when clicking unread marker badge", () => {
    const onSelectThread = vi.fn();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w8:t8",
            workspaceId: "w8",
            workspaceName: "Workspace 8",
            threadId: "t8",
            threadName: "Badge Thread",
            engine: "CLAUDE",
            preview: "recent preview",
            updatedAt: DAY_ONE + 5_000,
            isProcessing: false,
            startedAt: DAY_ONE + 1_000,
            completedAt: DAY_ONE + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const dateGroupToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_ONE_KEY) });
    if (!within(view.container).queryByRole("button", { name: /^Badge Thread$/i })) {
      fireEvent.click(dateGroupToggle);
    }
    const unreadBadge = within(view.container).getByLabelText("activityPanel.radar.unreadMark");
    fireEvent.click(unreadBadge);

    expect(onSelectThread).toHaveBeenCalledWith("w8", "t8");
    expect(within(view.container).queryByLabelText("activityPanel.radar.readMark")).toBeTruthy();
    expect(view.container.querySelector(".session-activity-radar-delete-button")).toBeTruthy();
  });

  it("does not trigger thread selection when deleting an unread recent item", () => {
    const onSelectThread = vi.fn();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w9:t9",
            workspaceId: "w9",
            workspaceName: "Workspace 9",
            threadId: "t9",
            threadName: "Unread Thread",
            engine: "CLAUDE",
            preview: "recent preview",
            updatedAt: DAY_ONE + 5_000,
            isProcessing: false,
            startedAt: DAY_ONE + 1_000,
            completedAt: DAY_ONE + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const dateGroupToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_ONE_KEY) });
    if (!within(view.container).queryByRole("button", { name: /^Unread Thread$/i })) {
      fireEvent.click(dateGroupToggle);
    }
    // 未读条目无需先标记已读即可删除
    expect(within(view.container).getByLabelText("activityPanel.radar.unreadMark")).toBeTruthy();
    const deleteButton = view.container.querySelector(".session-activity-radar-delete-button");
    expect(deleteButton).toBeTruthy();
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("does not expand date group or select thread when deleting all entries for a day", () => {
    const onSelectThread = vi.fn();
    vi.mocked(deleteSessionRadarHistoryEntries).mockClear();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w10:t10",
            workspaceId: "w10",
            workspaceName: "Workspace 10",
            threadId: "t10",
            threadName: "Date Group Thread",
            engine: "CLAUDE",
            preview: "recent preview",
            updatedAt: DAY_TWO + 1_000,
            isProcessing: false,
            startedAt: DAY_TWO,
            completedAt: DAY_TWO + 1_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const dateGroupToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_TWO_KEY) });
    // 唯一(最新)日期组默认展开,折叠状态用正向 aria-expanded 断言
    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(view.container).getByRole("button", { name: /^Date Group Thread$/i })).toBeTruthy();

    const deleteDateGroupButton = within(view.container).getByRole("button", {
      name: "activityPanel.radar.deleteDateGroupEntries",
    });
    fireEvent.click(deleteDateGroupButton);

    // 先弹 ConfirmDialog 二次确认（替代 WKWebView 下静默返回 false 的 window.confirm）
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("activityPanel.radar.confirmDeleteDateGroup");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.delete" }));

    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledTimes(1);
    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledWith([
      { id: "w10:t10", completedAt: DAY_TWO + 1_000, liveUpdatedAt: DAY_TWO + 1_000 },
    ]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onSelectThread).not.toHaveBeenCalled();
    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("passes live updatedAt so delete cutoff covers a live-refreshed entry", () => {
    // thread 刚更新（updatedAt 领先 persisted completedAt）、feed 尚未回写时用户
    // 立即删除：target 必须带 liveUpdatedAt，否则 cutoff 只覆盖 completedAt，
    // reconcile 以 thread.updatedAt 补写时条目会复活（B1 复活窗口）。
    vi.mocked(deleteSessionRadarHistoryEntries).mockClear();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w11:t11",
            workspaceId: "w11",
            workspaceName: "Workspace 11",
            threadId: "t11",
            threadName: "Live Refreshed Thread",
            engine: "CLAUDE",
            preview: "live preview",
            // live 刷新值领先 completedAt，模拟「刚更新未回写」
            updatedAt: DAY_TWO + 9_000,
            isProcessing: false,
            startedAt: DAY_TWO,
            completedAt: DAY_TWO + 1_000,
            durationMs: 1000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    const deleteButton = view.container.querySelector(".session-activity-radar-delete-button");
    expect(deleteButton).toBeTruthy();
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledTimes(1);
    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledWith([
      { id: "w11:t11", completedAt: DAY_TWO + 1_000, liveUpdatedAt: DAY_TWO + 9_000 },
    ]);
  });

  it("expands only the latest date group by default and preserves manual toggle", () => {
    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w20:t20",
            workspaceId: "w20",
            workspaceName: "Workspace 20",
            threadId: "t20",
            threadName: "Older Thread",
            engine: "CLAUDE",
            preview: "older preview",
            updatedAt: DAY_FIVE + 5_000,
            isProcessing: false,
            startedAt: DAY_FIVE + 1_000,
            completedAt: DAY_FIVE + 5_000,
            durationMs: 4000,
          },
          {
            id: "w20:t21",
            workspaceId: "w20",
            workspaceName: "Workspace 20",
            threadId: "t21",
            threadName: "Newer Thread",
            engine: "CLAUDE",
            preview: "newer preview",
            updatedAt: DAY_SIX + 5_000,
            isProcessing: false,
            startedAt: DAY_SIX + 1_000,
            completedAt: DAY_SIX + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    const olderToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_FIVE_KEY) });
    const newerToggle = within(view.container).getByRole("button", { name: new RegExp(DAY_SIX_KEY) });
    // 仅最新日期组默认展开,其余默认折叠
    expect(newerToggle.getAttribute("aria-expanded")).toBe("true");
    expect(olderToggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(view.container).getByRole("button", { name: /^Newer Thread$/i })).toBeTruthy();
    expect(within(view.container).queryByRole("button", { name: /^Older Thread$/i })).toBeNull();

    // 用户手动展开旧组后,选择被保留
    fireEvent.click(olderToggle);
    expect(olderToggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(view.container).getByRole("button", { name: /^Older Thread$/i })).toBeTruthy();
  });

  it("shows a recoverable error alert when deletion fails", () => {
    // 注入删除失败结果,验证面板不静默、展示 role="alert" 可恢复错误提示
    vi.mocked(deleteSessionRadarHistoryEntries).mockReturnValueOnce({
      succeededEntryIds: [],
      failed: [{ id: "w21:t21", code: "NOT_FOUND", message: "Radar history entry not found" }],
    });
    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w21:t21",
            workspaceId: "w21",
            workspaceName: "Workspace 21",
            threadId: "t21",
            threadName: "Failing Thread",
            engine: "CLAUDE",
            preview: "failing preview",
            updatedAt: DAY_SEVEN + 5_000,
            isProcessing: false,
            startedAt: DAY_SEVEN + 1_000,
            completedAt: DAY_SEVEN + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    const deleteButton = view.container.querySelector(".session-activity-radar-delete-button");
    expect(deleteButton).toBeTruthy();
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }
    const alert = within(view.container).getByRole("alert");
    expect(alert.textContent).toContain("activityPanel.radar.deleteFailedTitle");
    expect(alert.textContent).toContain("activityPanel.radar.deleteFailedBody");

    fireEvent.click(
      within(alert as HTMLElement).getByRole("button", {
        name: "activityPanel.radar.deleteFailedDismiss",
      }),
    );
    expect(within(view.container).queryByRole("alert")).toBeNull();
  });

  it("requires confirmation before deleting a whole date group", () => {
    vi.mocked(deleteSessionRadarHistoryEntries).mockClear();

    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w22:t22",
            workspaceId: "w22",
            workspaceName: "Workspace 22",
            threadId: "t22",
            threadName: "Confirm Thread",
            engine: "CLAUDE",
            preview: "confirm preview",
            updatedAt: DAY_EIGHT + 5_000,
            isProcessing: false,
            startedAt: DAY_EIGHT + 1_000,
            completedAt: DAY_EIGHT + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    const deleteDateGroupButton = within(view.container).getByRole("button", {
      name: "activityPanel.radar.deleteDateGroupEntries",
    });
    fireEvent.click(deleteDateGroupButton);

    // 取消分支：ConfirmDialog 点取消后不执行删除、条目仍在
    const cancelDialog = screen.getByRole("alertdialog");
    fireEvent.click(within(cancelDialog).getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteSessionRadarHistoryEntries).not.toHaveBeenCalled();
    expect(within(view.container).queryByRole("alert")).toBeNull();
    expect(within(view.container).getByRole("button", { name: /^Confirm Thread$/i })).toBeTruthy();

    // 确认分支：再次触发并点确认后才执行删除
    fireEvent.click(deleteDateGroupButton);
    const confirmDialog = screen.getByRole("alertdialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "common.delete" }));
    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledTimes(1);
    expect(deleteSessionRadarHistoryEntries).toHaveBeenCalledWith([
      { id: "w22:t22", completedAt: DAY_EIGHT + 5_000, liveUpdatedAt: DAY_EIGHT + 5_000 },
    ]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("syncs read state when radar history updated event fires", () => {
    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w23:t23",
            workspaceId: "w23",
            workspaceName: "Workspace 23",
            threadId: "t23",
            threadName: "Sync Thread",
            engine: "CLAUDE",
            preview: "sync preview",
            updatedAt: DAY_NINE + 5_000,
            isProcessing: false,
            startedAt: DAY_NINE + 1_000,
            completedAt: DAY_NINE + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    expect(within(view.container).getByLabelText("activityPanel.radar.unreadMark")).toBeTruthy();

    // 模拟设置页历史管理修改未读态后派发 SESSION_RADAR_HISTORY_UPDATED_EVENT
    act(() => {
      writeClientStoreValue(
        RADAR_STORE_NAME,
        SESSION_RADAR_READ_STATE_KEY,
        { "w23:t23": DAY_NINE + 60_000 },
        { immediate: true },
      );
      window.dispatchEvent(new CustomEvent(SESSION_RADAR_HISTORY_UPDATED_EVENT));
    });

    expect(within(view.container).queryByLabelText("activityPanel.radar.unreadMark")).toBeNull();
    expect(within(view.container).getByLabelText("activityPanel.radar.readMark")).toBeTruthy();
  });

  it("syncs collapsed date groups when radar history updated event fires", () => {
    const COLLAPSE_SYNC_DAY = new Date(2026, 4, 28, 10, 0, 0).getTime();
    const COLLAPSE_SYNC_DAY_KEY = "2026-05-28";
    const view = render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w30:t30",
            workspaceId: "w30",
            workspaceName: "Workspace 30",
            threadId: "t30",
            threadName: "Collapse Sync Thread",
            engine: "CLAUDE",
            preview: "collapse sync preview",
            updatedAt: COLLAPSE_SYNC_DAY + 5_000,
            isProcessing: false,
            startedAt: COLLAPSE_SYNC_DAY + 1_000,
            completedAt: COLLAPSE_SYNC_DAY + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    const dateGroupToggle = within(view.container).getByRole("button", {
      name: new RegExp(COLLAPSE_SYNC_DAY_KEY),
    });
    // 唯一(最新)日期组默认展开
    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("true");

    // 外部历史管理写入折叠态并派发事件后,面板即时同步折叠态
    act(() => {
      writeClientStoreValue(
        RADAR_STORE_NAME,
        SESSION_RADAR_COLLAPSED_DATE_GROUPS_KEY,
        { [COLLAPSE_SYNC_DAY_KEY]: true },
        { immediate: true },
      );
      window.dispatchEvent(new CustomEvent(SESSION_RADAR_HISTORY_UPDATED_EVENT));
    });

    expect(dateGroupToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("prunes stale date keys from persisted collapsed date groups", () => {
    const PRUNE_DAY = new Date(2026, 4, 29, 10, 0, 0).getTime();
    const PRUNE_DAY_KEY = "2026-05-29";
    // 预置一条已不存在 dateKey 的陈旧折叠记录
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_COLLAPSED_DATE_GROUPS_KEY,
      { "1999-12-31": true, [PRUNE_DAY_KEY]: true },
      { immediate: true },
    );

    render(
      <WorkspaceSessionRadarPanel
        runningSessions={[]}
        recentCompletedSessions={[
          {
            id: "w31:t31",
            workspaceId: "w31",
            workspaceName: "Workspace 31",
            threadId: "t31",
            threadName: "Prune Thread",
            engine: "CLAUDE",
            preview: "prune preview",
            updatedAt: PRUNE_DAY + 5_000,
            isProcessing: false,
            startedAt: PRUNE_DAY + 1_000,
            completedAt: PRUNE_DAY + 5_000,
            durationMs: 4000,
          },
        ]}
        onSelectThread={vi.fn()}
      />,
    );

    // 挂载后修剪效应只保留仍存在的 dateKey,陈旧记录被移除并同步写盘
    expect(
      getClientStoreSync(RADAR_STORE_NAME, SESSION_RADAR_COLLAPSED_DATE_GROUPS_KEY),
    ).toEqual({ [PRUNE_DAY_KEY]: true });
  });
});
