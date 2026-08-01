import { describe, expect, it } from "vitest";
import type { SessionActivityEvent } from "../session-activity/types";
import {
  applyRecentFileMutations,
  collectAiFileMutations,
  normalizeStoredRecentFiles,
  projectQuickSwitcherRecentFileGroups,
} from "./recentFiles";

describe("quick switcher recent files", () => {
  it("deduplicates, sorts by time, and caps each workspace at 30", () => {
    const mutations = Array.from({ length: 32 }, (_, index) => ({
      kind: "upsert" as const,
      workspaceId: "workspace-a",
      path: `src/file-${index}.ts`,
      touchedAt: index,
      source: "opened" as const,
    }));
    mutations.push({
      kind: "upsert",
      workspaceId: "workspace-a",
      path: "src/file-10.ts",
      touchedAt: 99,
      source: "opened",
    });

    const result = applyRecentFileMutations({}, mutations)["workspace-a"];

    expect(result).toHaveLength(30);
    expect(result?.[0]).toMatchObject({ path: "src/file-10.ts", touchedAt: 99 });
    expect(new Set(result?.map((entry) => entry.path)).size).toBe(30);
  });

  it("records only completed AI file changes and removes deleted files", () => {
    const baseEvent: SessionActivityEvent = {
      eventId: "event-1",
      threadId: "thread-1",
      threadName: "Session",
      sessionRole: "root",
      relationshipSource: "directParent",
      kind: "fileChange",
      occurredAt: 20,
      summary: "Changed files",
      status: "completed",
      fileChanges: [
        {
          filePath: "src/kept.ts",
          fileName: "kept.ts",
          statusLetter: "M",
          additions: 1,
          deletions: 0,
        },
        {
          filePath: "src/deleted.ts",
          fileName: "deleted.ts",
          statusLetter: "D",
          additions: 0,
          deletions: 1,
        },
      ],
    };

    const mutations = collectAiFileMutations("workspace-a", [
      baseEvent,
      { ...baseEvent, eventId: "event-2", status: "running" },
    ]);
    const result = applyRecentFileMutations(
      {
        "workspace-a": [
          {
            workspaceId: "workspace-a",
            path: "src/deleted.ts",
            touchedAt: 10,
            source: "opened",
          },
        ],
      },
      mutations,
    )["workspace-a"];

    expect(result).toEqual([
      {
        workspaceId: "workspace-a",
        path: "src/kept.ts",
        touchedAt: 20,
        source: "ai-modified",
        aiModifiedAt: 20,
      },
    ]);
  });

  it("does not let replayed AI history override a newer user open", () => {
    const current = {
      "workspace-a": [
        {
          workspaceId: "workspace-a",
          path: "src/App.tsx",
          touchedAt: 100,
          source: "opened" as const,
        },
      ],
    };

    expect(
      applyRecentFileMutations(current, [
        {
          kind: "upsert",
          workspaceId: "workspace-a",
          path: "src/App.tsx",
          touchedAt: 50,
          source: "ai-modified",
        },
        {
          kind: "remove",
          workspaceId: "workspace-a",
          path: "src/App.tsx",
          touchedAt: 60,
        },
      ]),
    ).toEqual(current);
  });

  it("preserves the AI-modified marker when the user reopens the file", () => {
    const result = applyRecentFileMutations(
      {
        "workspace-a": [
          {
            workspaceId: "workspace-a",
            path: "src/App.tsx",
            touchedAt: 10,
            source: "ai-modified",
            aiModifiedAt: 10,
          },
        ],
      },
      [
        {
          kind: "upsert",
          workspaceId: "workspace-a",
          path: "src/App.tsx",
          touchedAt: 20,
          source: "opened",
        },
      ],
    );

    expect(result["workspace-a"]?.[0]).toMatchObject({
      source: "opened",
      touchedAt: 20,
      aiModifiedAt: 10,
    });
  });

  it("sanitizes malformed persisted data and keeps the newest duplicate", () => {
    expect(
      normalizeStoredRecentFiles({
        "workspace-a": [
          null,
          { path: "missing-fields.ts" },
          {
            workspaceId: "workspace-a",
            path: "./src/App.tsx",
            touchedAt: 20,
            source: "opened",
          },
          {
            workspaceId: "workspace-a",
            path: "src/App.tsx",
            touchedAt: 10,
            source: "ai-modified",
          },
        ],
        broken: "not-an-array",
      }),
    ).toEqual({
      "workspace-a": [
        {
          workspaceId: "workspace-a",
          path: "src/App.tsx",
          touchedAt: 20,
          source: "opened",
        },
      ],
    });
  });

  it("filters non-file AI tool payloads while preserving real file paths", () => {
    const normalized = normalizeStoredRecentFiles({
      "workspace-a": [
        {
          workspaceId: "workspace-a",
          path: "null | head -n 80 /dev",
          touchedAt: 50,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: "spec.md; printf SEARCH_SPEC",
          touchedAt: 40,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: "/dev/null",
          touchedAt: 30,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: "docs/My Notes.md",
          touchedAt: 20,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: "README",
          touchedAt: 10,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: ".gitignore",
          touchedAt: 8,
          source: "ai-modified",
        },
        {
          workspaceId: "workspace-a",
          path: "notes;draft.md",
          touchedAt: 5,
          source: "opened",
        },
      ],
    });

    expect(normalized["workspace-a"]?.map((entry) => entry.path)).toEqual([
      "docs/My Notes.md",
      "README",
      ".gitignore",
      "notes;draft.md",
    ]);

    expect(
      applyRecentFileMutations({}, [
        {
          kind: "upsert",
          workspaceId: "workspace-a",
          path: "null | head -n 20 /dev",
          touchedAt: 60,
          source: "ai-modified",
        },
      ]),
    ).toEqual({});

    const baseEvent: SessionActivityEvent = {
      eventId: "event-shell-pollution",
      threadId: "thread-1",
      threadName: "Session",
      sessionRole: "root",
      relationshipSource: "directParent",
      kind: "fileChange",
      occurredAt: 60,
      summary: "Changed files",
      status: "completed",
      fileChanges: [
        {
          filePath: "null | head -n 20 /dev",
          fileName: "dev",
          statusLetter: "M",
          additions: 1,
          deletions: 0,
        },
        {
          filePath: "src/real-file.ts",
          fileName: "real-file.ts",
          statusLetter: "M",
          additions: 1,
          deletions: 0,
        },
      ],
    };

    expect(collectAiFileMutations("workspace-a", [baseEvent])).toEqual([
      {
        kind: "upsert",
        workspaceId: "workspace-a",
        path: "src/real-file.ts",
        touchedAt: 60,
        source: "ai-modified",
      },
    ]);
  });

  it("takes the global newest 30 files before grouping by workspace", () => {
    const alphaFiles = Array.from({ length: 30 }, (_, index) => ({
      workspaceId: "workspace-a",
      path: `src/alpha-${index}.ts`,
      touchedAt: index,
      source: "opened" as const,
    }));
    const groups = projectQuickSwitcherRecentFileGroups(
      {
        "workspace-a": alphaFiles,
        "workspace-b": [
          {
            workspaceId: "workspace-b",
            path: "src/beta.ts",
            touchedAt: 100,
            source: "ai-modified",
          },
        ],
      },
      [
        { id: "workspace-a", name: "Alpha" },
        { id: "workspace-b", name: "Beta" },
      ],
    );

    expect(groups.flatMap((group) => group.files)).toHaveLength(30);
    expect(groups[0]).toMatchObject({
      workspaceId: "workspace-b",
      workspaceName: "Beta",
      latestAt: 100,
    });
    expect(groups[1]?.files.at(-1)?.path).toBe("src/alpha-1.ts");
  });
});
