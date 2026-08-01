import { describe, expect, it } from "vitest";
import {
  extractSearchMatchCount,
  formatSearchMatchLabel,
  normalizeSearchSummaryText,
  resolveSearchInlinePresentation,
} from "./searchToolPresentation";

const GREP_WORKSPACE_OUTPUT = `<workspace_result workspace_path="/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui">
Found at least 65 matching lines
/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui/src/features/messages/presentation/messagesUserPresentation.ts
25: stickyCandidateText: string;
35: stickyCandidateText: string;
</workspace_result>`;

describe("searchToolPresentation", () => {
  it("extracts at-least match counts from workspace_result dumps", () => {
    expect(extractSearchMatchCount(GREP_WORKSPACE_OUTPUT)).toEqual({
      count: 65,
      atLeast: true,
    });
    expect(formatSearchMatchLabel({ count: 65, atLeast: true })).toBe("≥65 matches");
  });

  it("extracts exact match counts", () => {
    expect(extractSearchMatchCount("Found 12 matching lines")).toEqual({
      count: 12,
      atLeast: false,
    });
    expect(extractSearchMatchCount("3 matches")).toEqual({
      count: 3,
      atLeast: false,
    });
  });

  it("builds compact header from pattern + match count", () => {
    const presentation = resolveSearchInlinePresentation(
      GREP_WORKSPACE_OUTPUT,
      { pattern: "scroll|Scroll|stick|bottom|pin|jump|anchor" },
      { pattern: "scroll|Scroll|stick|bottom|pin|jump|anchor" },
    );

    expect(presentation.headerSummary).toBe(
      "scroll|Scroll|stick|bottom|pin|jump|anchor · ≥65 matches",
    );
    expect(presentation.resultHint).toBe("≥65 matches");
    expect(presentation.headerSummary).not.toContain("workspace_result");
    expect(presentation.headerSummary).not.toContain("workspace_path");
  });

  it("falls back to match label only when pattern is missing", () => {
    const presentation = resolveSearchInlinePresentation(GREP_WORKSPACE_OUTPUT, null);
    expect(presentation.headerSummary).toBe("≥65 matches");
    expect(presentation.resultHint).toBe("≥65 matches");
  });

  it("keeps url summaries clickable and readable", () => {
    const presentation = resolveSearchInlinePresentation(
      "https://openclaw.ai/",
      { query: "openclaw" },
      { pattern: "openclaw" },
    );
    expect(presentation.headerSummary).toBe("https://openclaw.ai/");
    expect(presentation.resultHint).toBe("https://openclaw.ai/");
  });

  it("normalizes json query detail to plain text", () => {
    const raw = JSON.stringify({ query: "https://openclaw.ai/" });
    expect(normalizeSearchSummaryText(raw, null)).toBe("https://openclaw.ai/");
    const presentation = resolveSearchInlinePresentation(raw, { query: "https://openclaw.ai/" });
    expect(presentation.headerSummary).toBe("https://openclaw.ai/");
  });

  it("preserves plain short detail text when output is empty", () => {
    const presentation = resolveSearchInlinePresentation("openclaw github", null);
    expect(presentation.headerSummary).toBe("openclaw github");
  });

  it("uses pattern alone for protocol-heavy output without match count", () => {
    const noisy = `<workspace_result workspace_path="/tmp/repo">
/tmp/repo/a.ts
1: hello
2: world
</workspace_result>`;
    const presentation = resolveSearchInlinePresentation(
      noisy,
      { pattern: "hello" },
      { pattern: "hello" },
    );
    expect(presentation.headerSummary).toBe("hello");
    expect(presentation.headerSummary).not.toContain("workspace_result");
  });
});
