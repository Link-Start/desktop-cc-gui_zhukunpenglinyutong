import { describe, expect, it } from "vitest";
import { formatDshModelDisplayLabel } from "./dshModelDisplayLabel";

describe("formatDshModelDisplayLabel", () => {
  it("shows the runtime model when the catalog label still has a provider prefix", () => {
    expect(
      formatDshModelDisplayLabel({
        id: "deepseek/DeepSeek-V4-Flash",
        model: "DeepSeek-V4-Flash",
        label: "DeepSeek / DeepSeek-V4-Flash",
      }),
    ).toBe("DeepSeek-V4-Flash");
    expect(
      formatDshModelDisplayLabel({
        id: "grok-4.6/Grok 4.5",
        model: "Grok 4.5",
        label: "grok-4.6 / Grok 4.5",
      }),
    ).toBe("Grok 4.5");
  });

  it("keeps only the last path segment of routed model ids", () => {
    expect(
      formatDshModelDisplayLabel({
        id: "vision-http/ovh/Qwen2.5-VL-72B-Instruct",
        model: "ovh/Qwen2.5-VL-72B-Instruct",
        label: "Vision HTTP / ovh/Qwen2.5-VL-72B-Instruct",
      }),
    ).toBe("Qwen2.5-VL-72B-Instruct");
  });

  it("falls back from composite label or catalog id when runtime is missing", () => {
    expect(
      formatDshModelDisplayLabel({
        id: "deepseek/DeepSeek-V4-Pro",
        label: "DeepSeek / DeepSeek-V4-Pro",
      }),
    ).toBe("DeepSeek-V4-Pro");
    expect(
      formatDshModelDisplayLabel({
        id: "grok-4.6/Grok 4.6",
      }),
    ).toBe("Grok 4.6");
  });
});
