import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "../../../types";
import {
  createInitialThreadState,
  threadReducer,
} from "./useThreadsReducer";

describe("threadReducer approvals", () => {
  it("keeps a newer approval when an older approval with the same request id is removed", () => {
    const previousApproval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: "shared-request",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "claude:thread-1",
        turnId: "turn-1",
        file_path: "bbb.txt",
      },
    };
    const nextApproval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: "shared-request",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "claude:thread-1",
        turnId: "turn-2",
        file_path: "ccc.txt",
      },
    };

    let state = createInitialThreadState();
    state = threadReducer(state, { type: "addApproval", approval: previousApproval });
    state = threadReducer(state, { type: "addApproval", approval: nextApproval });

    expect(state.approvals).toEqual([previousApproval, nextApproval]);

    state = threadReducer(state, {
      type: "removeApproval",
      requestId: previousApproval.request_id,
      workspaceId: previousApproval.workspace_id,
      approval: previousApproval,
    });

    expect(state.approvals).toEqual([nextApproval]);
  });

  it("keeps equal Shared request ids isolated by Runtime attempt", () => {
    const makeApproval = (
      attemptId: string,
      providerRuntimeKey: string,
    ): ApprovalRequest => ({
      workspace_id: "ws-1",
      request_id: "request-1",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "shared:thread-1",
        turnId: `turn-${attemptId}`,
        file_path: "demo.txt",
      },
      shared_runtime_owner: {
        attemptId,
        providerRuntimeKey,
        sharedThreadId: "shared:thread-1",
        nativeThreadId: `native-${attemptId}`,
        runtimeTurnId: `turn-${attemptId}`,
        engine: providerRuntimeKey.startsWith("claude")
          ? "claude"
          : "codex",
        providerProfileId: `profile-${attemptId}`,
      },
    });
    const firstApproval = makeApproval("attempt-1", "codex::profile-1");
    const secondApproval = makeApproval("attempt-2", "claude::profile-2");

    let state = createInitialThreadState();
    state = threadReducer(state, {
      type: "addApproval",
      approval: firstApproval,
    });
    state = threadReducer(state, {
      type: "addApproval",
      approval: secondApproval,
    });
    expect(state.approvals).toEqual([firstApproval, secondApproval]);

    state = threadReducer(state, {
      type: "removeApproval",
      requestId: firstApproval.request_id,
      workspaceId: firstApproval.workspace_id,
      approval: firstApproval,
    });
    expect(state.approvals).toEqual([secondApproval]);
  });
});
