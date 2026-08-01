import { describe, expect, it } from "vitest";
import {
  extractInlineFileReferenceTokens,
  mergeInlineFileReferences,
  type InlineFileReferenceSelection,
} from "./composerFileReferences";

const makeRef = (
  path: string,
  icon: "📁" | "📄" = "📄",
  name = "App.tsx",
): InlineFileReferenceSelection => ({
  id: `${icon}:${path}`,
  icon,
  label: `${icon} ${name}`,
  path,
});

describe("mergeInlineFileReferences", () => {
  it("appends only new references and preserves order", () => {
    const previous = [makeRef("/a", "📄", "a.ts")];
    const extracted = [
      makeRef("/a", "📄", "a.ts"),
      makeRef("/b", "📄", "b.ts"),
    ];
    const merged = mergeInlineFileReferences(previous, extracted);
    expect(merged).toEqual([
      makeRef("/a", "📄", "a.ts"),
      makeRef("/b", "📄", "b.ts"),
    ]);
    expect(merged).not.toBe(previous);
  });

  it("returns the same array reference when all extracted ids already exist", () => {
    // 旧实现总是 [...prev] → effect deps 变 → 再 extract → #185
    const previous = [makeRef("/Users/demo/repo/src/App.tsx")];
    const extracted = [makeRef("/Users/demo/repo/src/App.tsx")];
    const merged = mergeInlineFileReferences(previous, extracted);
    expect(merged).toBe(previous);
  });

  it("returns the same array reference when extracted is empty", () => {
    const previous = [makeRef("/a")];
    expect(mergeInlineFileReferences(previous, [])).toBe(previous);
  });

  it("stays reference-stable across repeated extract→merge when refs already tracked", () => {
    // 模拟 Composer effect：label 不在 text 时 existingReferenceIds 可能漏掉已选 id，
    // extract 仍可能把同 path 放进 extracted；merge 必须幂等。
    const path = "/Users/demo/repo/src/App.tsx";
    const previous = [makeRef(path)];
    let current = previous;
    for (let i = 0; i < 30; i += 1) {
      // 文本里仍是完整 token（无 label），existingIds 为空 → extracted 非空
      const text = `请检查 📄 App.tsx \`${path}\``;
      const { extracted } = extractInlineFileReferenceTokens(text, new Set());
      expect(extracted.length).toBeGreaterThan(0);
      current = mergeInlineFileReferences(current, extracted);
    }
    expect(current).toBe(previous);
  });
});

describe("extractInlineFileReferenceTokens", () => {
  it("converts visual tokens to labels and reports extracted refs", () => {
    const text =
      "请检查 📄 App.tsx `/Users/demo/repo/src/App.tsx`";
    const { cleanedText, extracted } = extractInlineFileReferenceTokens(text);
    expect(cleanedText).toBe("请检查 📄 App.tsx");
    expect(extracted).toEqual([
      makeRef("/Users/demo/repo/src/App.tsx"),
    ]);
  });

  it("does not re-extract when id is already in existingReferenceIds", () => {
    const path = "/Users/demo/repo/src/App.tsx";
    const id = `📄:${path}`;
    const text = `请检查 📄 App.tsx \`${path}\``;
    const { extracted } = extractInlineFileReferenceTokens(
      text,
      new Set([id]),
    );
    expect(extracted).toEqual([]);
  });
});
