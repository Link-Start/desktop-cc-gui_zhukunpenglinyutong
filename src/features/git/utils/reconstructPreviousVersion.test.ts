import { describe, expect, it } from "vitest";
import { reconstructPreviousVersion } from "./reconstructPreviousVersion";

describe("reconstructPreviousVersion", () => {
  it("reverses additions, deletions, and context from the working source", () => {
    const patch = [
      "diff --git a/example.ts b/example.ts",
      "--- a/example.ts",
      "+++ b/example.ts",
      "@@ -1,4 +1,5 @@",
      " const stable = true;",
      "-const label = 'before';",
      "+const label = 'after';",
      "+const enabled = true;",
      " return label;",
      " export default stable;",
      "",
    ].join("\n");

    expect(
      reconstructPreviousVersion(
        "const stable = true;\nconst label = 'after';\nconst enabled = true;\nreturn label;\nexport default stable;\n",
        patch,
      ),
    ).toBe(
      "const stable = true;\nconst label = 'before';\nreturn label;\nexport default stable;\n",
    );
  });

  it("returns an empty previous version for a newly added file", () => {
    const patch = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const value = 1;",
      "+export default value;",
      "",
    ].join("\n");

    expect(
      reconstructPreviousVersion(
        "export const value = 1;\nexport default value;\n",
        patch,
      ),
    ).toBe("");
  });

  it("supports multiple hunks and CRLF working sources", () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      "-one",
      "+ONE",
      " two",
      "@@ -4,2 +4,2 @@",
      " four",
      "-five",
      "+FIVE",
      "",
    ].join("\n");

    expect(reconstructPreviousVersion("ONE\r\ntwo\r\nthree\r\nfour\r\nFIVE\r\n", patch)).toBe(
      "one\r\ntwo\r\nthree\r\nfour\r\nfive\r\n",
    );
  });

  it("rejects a patch that does not match the working source", () => {
    const patch = ["@@ -1 +1 @@", "-before", "+after", ""].join("\n");

    expect(reconstructPreviousVersion("different\n", patch)).toBeNull();
  });

  it("rejects content without a unified hunk", () => {
    expect(reconstructPreviousVersion("current\n", "not a patch")).toBeNull();
  });
});
