import { describe, expect, it } from "vitest";
import {
  buildGeneratedImageConversationItem,
  isNativeGeneratedImageItemType,
  resolveConversationItemId,
} from "./threadItemsGeneratedImages";

describe("threadItemsGeneratedImages", () => {
  it("recognizes native generated image item type variants", () => {
    expect(isNativeGeneratedImageItemType("generatedImage")).toBe(true);
    expect(isNativeGeneratedImageItemType("image_generation_end")).toBe(true);
    expect(isNativeGeneratedImageItemType("toolCall")).toBe(false);
  });

  it("resolves direct ids before native generated image fallback ids", () => {
    expect(resolveConversationItemId("message", { id: "msg-1" })).toBe("msg-1");
    expect(
      resolveConversationItemId("image_generation_end", {
        call_id: "imagegen-call-1",
      }),
    ).toBe("imagegen-call-1");
    expect(resolveConversationItemId("message", { call_id: "ignored" })).toBe("");
  });

  it("builds generated image conversation items from native payloads", () => {
    const item = buildGeneratedImageConversationItem(
      "imagegen-native-1",
      "image_generation_end",
      {
        status: "completed",
        revised_prompt: "国风书生夜读插画",
        saved_path: "/Users/demo/.codex/generated_images/ig_native.png",
      },
    );

    expect(item).toMatchObject({
      id: "imagegen-native-1",
      kind: "generatedImage",
      status: "completed",
      sourceToolName: "image_generation_end",
    });
    expect(item.promptText).toContain("国风书生");
    expect(item.images[0]?.localPath).toBe(
      "/Users/demo/.codex/generated_images/ig_native.png",
    );
  });
});
