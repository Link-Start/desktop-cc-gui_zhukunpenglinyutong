import { describe, expect, it } from "vitest";
import {
  enrichSubagentCardStatuses,
  isSubagentFinishedOutput,
  resolveSyntheticChildToolStatus,
} from "./subagentCardStatus";
import type { SubagentCardViewModel } from "./subagentViewModel";

function card(
  overrides: Partial<SubagentCardViewModel> & Pick<SubagentCardViewModel, "id">,
): SubagentCardViewModel {
  return {
    displayName: "t",
    indexLabel: "01",
    description: "d",
    typeLabel: "agent",
    status: "running",
    progress: 0.2,
    toolCount: null,
    outputText: null,
    taskOutput: null,
    githubLogin: null,
    githubProfileUrl: null,
    avatarSrc: null,
    agentId: null,
    sessionThreadId: null,
    ...overrides,
  };
}

describe("subagentCardStatus", () => {
  it("detects finished output beyond start ack", () => {
    expect(
      isSubagentFinishedOutput(
        "Subagent started in background.\nsubagent_id: abc\ntype: general-purpose",
      ),
    ).toBe(false);
    expect(
      isSubagentFinishedOutput(
        "Subagent completed.\nsubagent_id: abc\nstatus: completed\n湘宁大兄弟你好",
      ),
    ).toBe(true);
    expect(
      isSubagentFinishedOutput(
        '<subagent outcome="completed">## report</subagent>',
      ),
    ).toBe(true);
  });

  it("upgrades running card when child session has assistant text and not processing", () => {
    const enriched = enrichSubagentCardStatuses(
      [
        card({
          id: "c1",
          status: "running",
          sessionThreadId: "grok:child-1",
          outputText: "Subagent started in background.\nsubagent_id: grok:child-1",
        }),
      ],
      {
        statusById: { "grok:child-1": { isProcessing: false } },
        itemsByThread: {
          "grok:child-1": [
            {
              id: "m1",
              kind: "message",
              role: "assistant",
              text: "湘宁大兄弟你好！我是子代理",
            },
          ],
        },
      },
    );
    expect(enriched[0]?.status).toBe("completed");
    expect(enriched[0]?.progress).toBe(1);
  });

  it("keeps running when child is still processing", () => {
    expect(
      resolveSyntheticChildToolStatus("grok:c", {
        statusById: { "grok:c": { isProcessing: true } },
      }),
    ).toBe("running");
  });

  it("defaults historical non-degraded child to completed", () => {
    expect(
      resolveSyntheticChildToolStatus("grok:c", {
        isDegraded: false,
        statusById: { "grok:c": { isProcessing: false } },
      }),
    ).toBe("completed");
  });
});
