import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const checkerPath = path.resolve("scripts/check-messages-boundaries.mjs");
const fixtureRoots: string[] = [];

function writeFixtureFile(root: string, relativePath: string, source: string) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, "utf8");
}

function runChecker(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "messages-boundaries-"));
  fixtureRoots.push(root);
  for (const [relativePath, source] of Object.entries(files)) {
    writeFixtureFile(root, relativePath, source);
  }
  try {
    const stdout = execFileSync(process.execPath, [checkerPath, "--root", root], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const result = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: result.status ?? 1,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
  }
}

afterEach(() => {
  while (fixtureRoots.length > 0) {
    rmSync(fixtureRoots.pop()!, { recursive: true, force: true });
  }
});

describe("messages boundary checker", () => {
  it("allows the public messages index and neutral shared owners", () => {
    const result = runChecker({
      "src/features/composer/public.ts":
        'import { Messages } from "../messages/index"; export { Messages };',
      "src/features/messages/rows/neutral.ts":
        'import type { ConversationItem } from "../../../../types"; export type Item = ConversationItem;',
      "src/features/messages/index.ts": "export const Messages = {};",
      "src/types.ts": "export type ConversationItem = { id: string };",
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain("new=0");
  });

  it("allows extensionful imports of the public messages index", () => {
    const result = runChecker({
      "src/features/composer/public.ts":
        'import { Messages } from "../messages/index.ts"; export { Messages };',
      "src/features/messages/index.ts": "export const Messages = {};",
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain("new=0");
  });

  it("rejects an external import of a messages private path", () => {
    const result = runChecker({
      "src/features/composer/private.ts":
        'import "../messages/components/PrivateMessageView";',
      "src/features/messages/components/PrivateMessageView.ts": "export {};",
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("[outside -> messages private]");
    expect(result.output).toContain("src/features/composer/private.ts:1");
  });

  it("reports threads imports of messages implementation explicitly", () => {
    const result = runChecker({
      "src/features/threads/private.ts":
        'import "../messages/orchestration/privateController";',
      "src/features/messages/orchestration/privateController.ts": "export {};",
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("[threads -> messages private]");
  });

  it("rejects rows imports from timeline or orchestration", () => {
    const result = runChecker({
      "src/features/messages/rows/private.ts":
        'import "../timeline/privateProjection"; import "../orchestration/privateController";',
      "src/features/messages/timeline/privateProjection.ts": "export {};",
      "src/features/messages/orchestration/privateController.ts": "export {};",
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("[messages rows -> controller owner]");
  });

  it("rejects pure timeline imports from component paths", () => {
    const result = runChecker({
      "src/features/messages/timeline/virtualization/private.ts":
        'import "../../components/PrivateRow";',
      "src/features/messages/components/PrivateRow.tsx": "export const PrivateRow = null;",
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("[pure timeline -> React components]");
  });
});
