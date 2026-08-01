import { describe, expect, it } from "vitest";
import { extractInlineSelections, mergeUniqueNames } from "./inlineSelections";

describe("mergeUniqueNames", () => {
  it("keeps existing order and appends only new names", () => {
    expect(mergeUniqueNames(["review", "debug"], ["debug", "docs", "review"])).toEqual([
      "review",
      "debug",
      "docs",
    ]);
  });

  it("returns the same array reference when all names already exist", () => {
    const previous = ["review", "debug"];
    const merged = mergeUniqueNames(previous, ["debug", "review"]);
    expect(merged).toBe(previous);
  });

  it("returns the same array reference when incoming is empty", () => {
    const previous = ["review"];
    expect(mergeUniqueNames(previous, [])).toBe(previous);
  });
});

describe("extractInlineSelections", () => {
  it("extracts slash skills and commons", () => {
    const result = extractInlineSelections(
      "/find-skills /team-rules 帮我分析",
      [{ name: "find-skills" }],
      [{ name: "team-rules" }],
    );

    expect(result.cleanedText).toBe("帮我分析");
    expect(result.matchedSkillNames).toEqual(["find-skills"]);
    expect(result.matchedCommonsNames).toEqual(["team-rules"]);
  });

  it("merge after extract is reference-stable when skills already selected", () => {
    const selected = ["find-skills"];
    const extracted = extractInlineSelections(
      "/find-skills 继续",
      [{ name: "find-skills" }],
      [],
    );
    // 模拟 Composer effect：已选中的 skill 再次 merge 不得换数组引用
    const merged = mergeUniqueNames(selected, extracted.matchedSkillNames);
    expect(merged).toBe(selected);
    expect(extracted.cleanedText).toBe("继续");
  });

  it("extracts dollar skill aliases and keeps commons slash-only", () => {
    const result = extractInlineSelections(
      "$Code Review $team-rules /team-rules 请给建议",
      [{ name: "Code Review" }],
      [{ name: "team-rules" }],
    );

    expect(result.cleanedText).toBe("$team-rules 请给建议");
    expect(result.matchedSkillNames).toEqual(["Code Review"]);
    expect(result.matchedCommonsNames).toEqual(["team-rules"]);
  });
});
