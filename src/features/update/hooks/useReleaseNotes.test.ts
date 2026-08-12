import { describe, expect, it } from "vitest";
import {
  findReleaseIndex,
  normalizeReleaseVersion,
  parseChangelogEntries,
  type ReleaseNotesEntry,
} from "./useReleaseNotes";

/** Re-export surface: keep hook public API stable for existing imports. */
describe("useReleaseNotes public re-exports", () => {
  it("exposes normalizeReleaseVersion", () => {
    expect(normalizeReleaseVersion("v1.2.3")).toBe("1.2.3");
  });

  it("exposes parseChangelogEntries", () => {
    const entries = parseChangelogEntries(`
### **2026年1月1日（v1.0.0）**

English:
- hello

中文：
- 你好
`);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.version).toBe("1.0.0");
  });

  it("exposes findReleaseIndex", () => {
    const entries: ReleaseNotesEntry[] = [
      {
        id: "1.0.0",
        tagName: "v1.0.0",
        version: "1.0.0",
        title: "v1.0.0",
        dateLabel: "2026/01/01",
        englishBody: "",
        chineseBody: "",
      },
    ];
    expect(findReleaseIndex(entries, "1.0.0")).toBe(0);
  });
});
