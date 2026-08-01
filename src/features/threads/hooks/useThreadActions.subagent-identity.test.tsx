// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { resetUseThreadActionsTestMocks } from "./useThreadActions.test-mocks";
import { listThreads } from "../../../services/tauri";
import { getThreadTimestamp } from "../../../utils/threadItems";
import {
  expectSetThreadsDispatched,
  renderActions,
  workspace,
} from "./useThreadActions.test-utils";

describe("useThreadActions Codex subagent identity", () => {
  beforeEach(() => {
    resetUseThreadActionsTestMocks();
  });

  it("projects identity while building live thread summaries", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "child-thread",
            cwd: "/tmp/codex",
            preview: "我",
            updated_at: 5000,
            parentThreadId: "parent-thread",
            agentNickname: "Herschel",
            source: {
              subagent: {
                thread_spawn: {
                  parent_thread_id: "parent-thread",
                  depth: 1,
                  agent_path: "/root/cohesion_audit",
                  agent_nickname: "Herschel",
                  agent_role: null,
                },
              },
            },
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expectSetThreadsDispatched(dispatch, "ws-1", [
      {
        id: "child-thread",
        name: "Herschel",
        updatedAt: 5000,
        engineSource: "codex",
        parentThreadId: "parent-thread",
      },
    ]);
  });
});
