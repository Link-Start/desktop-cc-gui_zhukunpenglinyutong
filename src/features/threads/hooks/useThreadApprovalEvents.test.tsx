// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../../types";
import { respondToServerRequest } from "../../../services/tauri";
import {
  getApprovalCommandInfo,
  matchesCommandPrefix,
} from "../../../utils/approvalRules";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";

vi.mock("../../../services/tauri", () => ({
  respondToServerRequest: vi.fn(),
}));

vi.mock("../../../utils/approvalRules", () => ({
  getApprovalCommandInfo: vi.fn(),
  matchesCommandPrefix: vi.fn(),
}));

describe("useThreadApprovalEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(respondToServerRequest).mockResolvedValue(undefined as never);
  });

  it("auto-accepts allowlisted approvals", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 42,
      method: "approval/request",
      params: { argv: ["git", "status"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "status"],
      preview: "git status",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        markProcessing,
        setActiveTurnId,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(respondToServerRequest).toHaveBeenCalledWith("ws-1", 42, "accept", null);
    expect(markProcessing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches approvals that do not match the allowlist", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 7,
      method: "approval/request",
      params: { argv: ["git", "pull"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "pull"],
      preview: "git pull",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(false);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        markProcessing,
        setActiveTurnId,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(respondToServerRequest).not.toHaveBeenCalled();
    expect(markProcessing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
  });

  it("stops thread processing when approval arrives with thread id", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const approvalAllowlistRef = {
      current: {},
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: "tool-1",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "claude:thread-1",
        file_path: "/tmp/demo.txt",
      },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue(null);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        markProcessing,
        setActiveTurnId,
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(markProcessing).toHaveBeenCalledWith("claude:thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("claude:thread-1", null);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "claude:thread-1",
      item: {
        id: "tool-1",
        kind: "tool",
        toolType: "fileChange",
        title: "Pending file approval",
        detail: JSON.stringify({
          threadId: "claude:thread-1",
          file_path: "/tmp/demo.txt",
        }),
        status: "pending",
        output: "Waiting for approval. This file change has not been executed.",
        changes: [{ path: "/tmp/demo.txt" }],
      },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "addApproval",
      approval,
    });
  });

  it("normalizes Claude approval thread ids before storing approval state", () => {
    const dispatch = vi.fn();
    const markProcessing = vi.fn();
    const setActiveTurnId = vi.fn();
    const approvalAllowlistRef = {
      current: {},
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: "tool-2",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "claude:stale",
        turnId: "turn-1",
        file_path: "/tmp/demo.txt",
      },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue(null);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        markProcessing,
        setActiveTurnId,
        resolveClaudeContinuationThreadId: () => "claude:canonical",
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(markProcessing).toHaveBeenCalledWith("claude:canonical", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("claude:canonical", null);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "claude:canonical",
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "addApproval",
      approval: {
        ...approval,
        params: {
          ...approval.params,
          threadId: "claude:canonical",
          thread_id: "claude:canonical",
        },
      },
    });
  });

  it("routes allowlisted Shared approval to its exact Runtime owner and requeues on failure", async () => {
    const dispatch = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const sharedRuntimeOwner = {
      attemptId: "attempt-1",
      providerRuntimeKey: "codex::profile-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "native-thread-1",
      runtimeTurnId: "runtime-turn-1",
      engine: "codex" as const,
      providerProfileId: "profile-1",
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 42,
      method: "approval/request",
      params: {
        threadId: sharedRuntimeOwner.sharedThreadId,
        turnId: sharedRuntimeOwner.runtimeTurnId,
        argv: ["git", "status"],
      },
      shared_runtime_owner: sharedRuntimeOwner,
    };
    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "status"],
      preview: "git status",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);
    vi.mocked(respondToServerRequest).mockRejectedValue(
      new Error("Runtime unavailable"),
    );
    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef,
        markProcessing: vi.fn(),
        setActiveTurnId: vi.fn(),
      }),
    );

    await act(async () => {
      result.current(approval);
      await Promise.resolve();
    });

    expect(respondToServerRequest).toHaveBeenCalledWith(
      "ws-1",
      42,
      "accept",
      sharedRuntimeOwner,
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "addApproval",
      approval,
    });
  });

  it("scopes Shared approval presentation item id to its attempt", () => {
    const dispatch = vi.fn();
    const sharedRuntimeOwner = {
      attemptId: "attempt-1",
      providerRuntimeKey: "claude::profile-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "native-thread-1",
      runtimeTurnId: "runtime-turn-1",
      engine: "claude" as const,
      providerProfileId: "profile-1",
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: "request-1",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: sharedRuntimeOwner.sharedThreadId,
        turnId: sharedRuntimeOwner.runtimeTurnId,
        file_path: "/tmp/demo.txt",
      },
      shared_runtime_owner: sharedRuntimeOwner,
    };
    vi.mocked(getApprovalCommandInfo).mockReturnValue(null);
    const { result } = renderHook(() =>
      useThreadApprovalEvents({
        dispatch,
        approvalAllowlistRef: { current: {} },
        markProcessing: vi.fn(),
        setActiveTurnId: vi.fn(),
      }),
    );

    act(() => {
      result.current(approval);
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          id: "shared-approval-attempt-1-request-1",
        }),
      }),
    );
  });
});
