import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { saveMermaidPngFile } from "./mermaidExport";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("saveMermaidPngFile", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("maps the PNG bytes to the native command payload", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await saveMermaidPngFile("/tmp/mermaid.png", [137, 80, 78, 71]);

    expect(invoke).toHaveBeenCalledWith("save_mermaid_png", {
      path: "/tmp/mermaid.png",
      pngBytes: [137, 80, 78, 71],
    });
  });

  it("propagates native persistence failures", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("write failed"));

    await expect(
      saveMermaidPngFile("/tmp/mermaid.png", [137, 80, 78, 71]),
    ).rejects.toThrow("write failed");
  });
});
