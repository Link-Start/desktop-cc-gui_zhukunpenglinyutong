import { describe, expect, it } from "vitest";
import type { SemanticDiffEntry } from "../../git/utils/semanticDiffSummary";
import {
  buildTurnSemanticReviewPrompt,
  parseTurnSemanticReviewResponse,
} from "./turnSemanticReview";

const ENTRIES: SemanticDiffEntry[] = [
  {
    path: "src/App.tsx",
    status: "M",
    diff: "@@ -1 +1 @@\n-old\n+new",
  },
  {
    path: "src/util.ts",
    status: "A",
    diff: "@@ -0,0 +1,3 @@\n+export const a = 1;",
  },
];

describe("buildTurnSemanticReviewPrompt", () => {
  it("includes file paths, status and diff content", () => {
    const prompt = buildTurnSemanticReviewPrompt(ENTRIES, "en");
    expect(prompt).toContain("src/App.tsx");
    expect(prompt).toContain("src/util.ts");
    expect(prompt).toContain("(status: M)");
    expect(prompt).toContain("-old");
    expect(prompt).toContain("Allowed evidence file paths");
  });

  it("requests Chinese fact text for zh UI language", () => {
    const prompt = buildTurnSemanticReviewPrompt(ENTRIES, "zh-CN");
    expect(prompt).toContain("Output fact text in Chinese.");
  });

  it("truncates oversized diffs within budget", () => {
    const hugeDiff = `@@ -1 +1 @@\n+${"x".repeat(20_000)}`;
    const prompt = buildTurnSemanticReviewPrompt(
      [{ path: "src/big.ts", status: "M", diff: hugeDiff }],
      "en",
    );
    expect(prompt.length).toBeLessThan(hugeDiff.length);
    expect(prompt).toContain("[diff truncated for budget]");
  });

  it("skips image entries", () => {
    const prompt = buildTurnSemanticReviewPrompt(
      [{ path: "assets/logo.png", status: "M", diff: "binary", isImage: true }],
      "en",
    );
    expect(prompt).not.toContain("assets/logo.png");
  });
});

describe("parseTurnSemanticReviewResponse", () => {
  it("parses a valid JSON payload into TurnSemanticReview facts", () => {
    const response = JSON.stringify({
      facts: [
        {
          category: "intent",
          text: "Adds a review surface entry.",
          confidence: "high",
          evidence: [{ path: "src/App.tsx", line: 12 }],
        },
        {
          category: "risk",
          text: "Config change may affect runtime.",
          confidence: "medium",
          evidence: [{ path: "src/util.ts" }],
        },
      ],
    });
    const review = parseTurnSemanticReviewResponse(response, ENTRIES);
    expect(review).not.toBeNull();
    expect(review?.source).toBe("ai");
    expect(review?.facts).toHaveLength(2);
    expect(review?.facts[0]).toMatchObject({
      category: "intent",
      confidence: "high",
      evidenceRefs: [
        { type: "diffHunk", id: "src/App.tsx:12", path: "src/App.tsx", line: 12 },
      ],
    });
    expect(review?.facts[1]?.evidenceRefs).toEqual([
      { type: "file", id: "src/util.ts", path: "src/util.ts" },
    ]);
  });

  it("parses fenced JSON output", () => {
    const response = `Here is the review:\n\`\`\`json\n{"facts":[{"category":"behavior","text":"Handler wired.","confidence":"low","evidence":[{"path":"src/App.tsx"}]}]}\n\`\`\``;
    const review = parseTurnSemanticReviewResponse(response, ENTRIES);
    expect(review?.facts).toHaveLength(1);
    expect(review?.facts[0]?.category).toBe("behavior");
  });

  it("drops facts without evidence refs or with unknown evidence paths", () => {
    const response = JSON.stringify({
      facts: [
        {
          category: "intent",
          text: "No evidence at all.",
          confidence: "high",
          evidence: [],
        },
        {
          category: "intent",
          text: "Evidence outside this turn.",
          confidence: "high",
          evidence: [{ path: "src/other-file.ts", line: 3 }],
        },
        {
          category: "intent",
          text: "Valid fact stays.",
          confidence: "high",
          evidence: [{ path: "src/App.tsx" }],
        },
      ],
    });
    const review = parseTurnSemanticReviewResponse(response, ENTRIES);
    expect(review?.facts).toHaveLength(1);
    expect(review?.facts[0]?.text).toBe("Valid fact stays.");
  });

  it("drops facts with invalid category or confidence", () => {
    const response = JSON.stringify({
      facts: [
        {
          category: "summary",
          text: "Bad category.",
          confidence: "high",
          evidence: [{ path: "src/App.tsx" }],
        },
        {
          category: "risk",
          text: "Bad confidence.",
          confidence: "certain",
          evidence: [{ path: "src/App.tsx" }],
        },
      ],
    });
    const review = parseTurnSemanticReviewResponse(response, ENTRIES);
    expect(review?.facts).toHaveLength(0);
  });

  it("returns null when the output contains no parseable payload", () => {
    expect(parseTurnSemanticReviewResponse("no json here at all", ENTRIES)).toBeNull();
    expect(parseTurnSemanticReviewResponse("{not valid json", ENTRIES)).toBeNull();
    expect(parseTurnSemanticReviewResponse('{"summary":"missing facts"}', ENTRIES)).toBeNull();
    expect(parseTurnSemanticReviewResponse("", ENTRIES)).toBeNull();
  });

  it("returns null when the turn has no usable entries", () => {
    const response = JSON.stringify({
      facts: [
        {
          category: "intent",
          text: "Anything.",
          confidence: "high",
          evidence: [{ path: "src/App.tsx" }],
        },
      ],
    });
    expect(parseTurnSemanticReviewResponse(response, [])).toBeNull();
  });
});
