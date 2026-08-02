import { describe, expect, it } from "vitest";
import {
  buildTranscriptItemsFromSubagentFallback,
  isSyntheticSubagentMetaOutput,
} from "./subagentDetailTranscript";

describe("subagentDetailTranscript", () => {
  it("detects synthetic meta blocks", () => {
    expect(
      isSyntheticSubagentMetaOutput(
        "Subagent completed.\nsubagent_id: 019fc217-4b28\ntype: general-purpose\ndescription: Euler\nstatus: completed\n你好",
      ),
    ).toBe(true);
    expect(isSyntheticSubagentMetaOutput("just a greeting")).toBe(false);
  });

  it("builds user+assistant items from synthetic meta + greeting", () => {
    const items = buildTranscriptItemsFromSubagentFallback({
      cardId: "c1",
      description: "Euler",
      outputText: [
        "Subagent completed.",
        "subagent_id: 019fc217-4b28-7c03-94b4-b1be16d1045a",
        "type: general-purpose",
        "description: Euler",
        "status: completed",
        "你好! 我是子 agent 3 号 很高兴为你服务",
      ].join("\n"),
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "message", role: "user", text: "Euler" });
    expect(items[1]).toMatchObject({
      kind: "message",
      role: "assistant",
    });
    expect(String((items[1] as { text?: string }).text)).toContain("子 agent 3");
  });
});
