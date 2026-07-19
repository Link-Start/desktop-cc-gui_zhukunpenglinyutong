import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { noteCardCreate } from "./noteCards";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("noteCardCreate", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("maps optional capture source into the create command", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: "note-1" });

    await noteCardCreate({
      workspaceId: "workspace-1",
      workspaceName: "Mossx",
      workspacePath: "/repo/mossx",
      title: "Selection",
      bodyMarkdown: "```ts\nconst value = 1;\n```",
      source: {
        kind: "codeSelection",
        path: "src/demo.ts",
        startLine: 3,
        endLine: 3,
        language: "typescript",
      },
    });

    expect(invoke).toHaveBeenCalledWith("note_card_create", {
      input: {
        workspaceId: "workspace-1",
        workspaceName: "Mossx",
        workspacePath: "/repo/mossx",
        title: "Selection",
        bodyMarkdown: "```ts\nconst value = 1;\n```",
        attachmentInputs: null,
        source: {
          kind: "codeSelection",
          path: "src/demo.ts",
          startLine: 3,
          endLine: 3,
          language: "typescript",
        },
      },
    });
  });
});
