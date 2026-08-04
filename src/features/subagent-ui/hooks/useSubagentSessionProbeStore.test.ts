import { describe, expect, it, beforeEach } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  clearSubagentSessionProbeStore,
  getSubagentSessionProbeSnapshot,
  mergeSubagentEnrichmentSources,
  publishSubagentSessionProbe,
} from "./useSubagentSessionProbeStore";
import {
  closeSubagentInspector,
  getSubagentInspectorSelection,
  openSubagentInspector,
} from "./useSubagentInspectorStore";
import { enrichSubagentCardStatuses } from "../utils/subagentCardStatus";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";

function assistant(text: string): ConversationItem {
  return {
    id: `m-${text.slice(0, 8)}`,
    kind: "message",
    role: "assistant",
    text,
  };
}

function runningCard(
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
    outputText: "Subagent started in background.\nsubagent_id: child-1",
    taskOutput: null,
    githubLogin: null,
    githubProfileUrl: null,
    avatarSrc: null,
    agentId: null,
    sessionThreadId: "grok:child-1",
    ...overrides,
  };
}

describe("useSubagentSessionProbeStore", () => {
  beforeEach(() => {
    clearSubagentSessionProbeStore();
    closeSubagentInspector();
  });

  it("publishes items and marks finished when assistant text present", () => {
    publishSubagentSessionProbe("grok:child-1", [
      assistant("你好！我是子 agent 1 号"),
    ]);
    const snap = getSubagentSessionProbeSnapshot();
    expect(snap.itemsByThread["grok:child-1"]?.length).toBe(1);
    expect(snap.statusById["grok:child-1"]?.isProcessing).toBe(false);
  });

  it("merge fills holes so enrich upgrades running card", () => {
    publishSubagentSessionProbe("grok:child-1", [
      assistant("湘宁大兄弟你好！任务完成"),
    ]);
    const enrichment = mergeSubagentEnrichmentSources({
      statusById: {},
      itemsByThread: {},
    });
    const cards = enrichSubagentCardStatuses(
      [runningCard({ id: "c1", sessionThreadId: "grok:child-1" })],
      enrichment,
    );
    expect(cards[0]?.status).toBe("completed");
    expect(cards[0]?.progress).toBe(1);
  });

  it("does not overwrite canvas items that already have assistant text", () => {
    const canvasItems: ConversationItem[] = [assistant("live assistant")];
    publishSubagentSessionProbe("grok:child-1", [assistant("probe shorter")]);
    const enrichment = mergeSubagentEnrichmentSources({
      itemsByThread: { "grok:child-1": canvasItems },
    });
    expect(enrichment.itemsByThread["grok:child-1"]).toBe(canvasItems);
  });

  it("publish upgrades open inspector status without waiting for squad re-render", () => {
    openSubagentInspector(
      runningCard({
        id: "c1",
        sessionThreadId: "grok:child-1",
        status: "running",
        progress: 0.2,
      }),
    );
    publishSubagentSessionProbe("grok:child-1", [
      assistant("你好！我是子 agent 1 号，任务完成"),
    ]);
    expect(getSubagentInspectorSelection()?.status).toBe("completed");
    expect(getSubagentInspectorSelection()?.progress).toBe(1);
  });
});
