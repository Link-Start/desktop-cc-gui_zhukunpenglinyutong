/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../files/components/WorkspaceFileComparePanel", () => ({
  useFileCompareEditorTheme: () => ({}),
  CompareEditorColumn: ({ draft }: { draft: { id: string; content: string } }) =>
    createElement("pre", { "data-testid": draft.id }, draft.content),
}));

import { buildReadOnlyCompareSources } from "./WorkspaceReadOnlyDiffCompare";
import { WorkspaceReadOnlyDiffCompare } from "./WorkspaceReadOnlyDiffCompare";

afterEach(cleanup);

describe("buildReadOnlyCompareSources", () => {
  it("maps unified patch context, deletions and additions into read-only sources", () => {
    expect(
      buildReadOnlyCompareSources(
        "@@ -1,3 +1,4 @@\n same\n-old\n+new\n+added\n tail\n",
      ),
    ).toEqual([
      "same\nold\ntail",
      "same\nnew\nadded\ntail",
    ]);
  });

  it("separates multiple hunks without exposing patch metadata", () => {
    expect(
      buildReadOnlyCompareSources(
        "@@ -1 +1 @@\n-old one\n+new one\n@@ -10 +10 @@\n-old ten\n+new ten\n",
      ),
    ).toEqual([
      "old one\n\nold ten",
      "new one\n\nnew ten",
    ]);
  });
});

describe("WorkspaceReadOnlyDiffCompare", () => {
  it("replaces the fallback patch with the loaded full-context patch", async () => {
    render(createElement(WorkspaceReadOnlyDiffCompare, {
      filePath: "example.ts",
      diff: "@@ -2 +2 @@\n-old\n+new\n",
      loadFullDiff: vi.fn(async () => "@@ -1,3 +1,3 @@\n first\n-old\n+new\n last\n"),
      useFullDiff: true,
    }));

    await waitFor(() => {
      expect(screen.getByTestId("previous:example.ts").textContent).toBe("first\nold\nlast");
      expect(screen.getByTestId("source:example.ts").textContent).toBe("first\nnew\nlast");
    });
  });

  it("keeps the fallback patch when full-context loading fails", async () => {
    const loadFullDiff = vi.fn(async () => {
      throw new Error("offline");
    });
    render(createElement(WorkspaceReadOnlyDiffCompare, {
      filePath: "example.ts",
      diff: "@@ -1 +1 @@\n-old\n+new\n",
      loadFullDiff,
      useFullDiff: true,
    }));

    await waitFor(() => expect(loadFullDiff).toHaveBeenCalledWith("example.ts"));
    expect(screen.getByTestId("previous:example.ts").textContent).toBe("old");
    expect(screen.getByTestId("source:example.ts").textContent).toBe("new");
  });

  it("ignores a stale full-context response after switching files", async () => {
    let resolveFirstRequest: (value: string) => void = () => {};
    const firstRequest = new Promise<string>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const loadFullDiff = vi.fn((path: string) =>
      path === "first.ts"
        ? firstRequest
        : Promise.resolve("@@ -1 +1 @@\n-second old\n+second new\n"),
    );
    const { rerender } = render(createElement(WorkspaceReadOnlyDiffCompare, {
      filePath: "first.ts",
      diff: "@@ -1 +1 @@\n-first old\n+first new\n",
      loadFullDiff,
      useFullDiff: true,
    }));

    rerender(createElement(WorkspaceReadOnlyDiffCompare, {
      filePath: "second.ts",
      diff: "@@ -1 +1 @@\n-second fallback\n+second fallback new\n",
      loadFullDiff,
      useFullDiff: true,
    }));
    await waitFor(() => {
      expect(screen.getByTestId("source:second.ts").textContent).toBe("second new");
    });

    resolveFirstRequest("@@ -1 +1 @@\n-stale old\n+stale new\n");
    await Promise.resolve();
    expect(screen.getByTestId("source:second.ts").textContent).toBe("second new");
  });
});
