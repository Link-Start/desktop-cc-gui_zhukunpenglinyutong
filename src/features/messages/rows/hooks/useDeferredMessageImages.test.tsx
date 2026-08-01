// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateClaudeDeferredImage } from "../../../../services/tauri";
import type { ClaudeDeferredImage } from "../../../../types";
import { useDeferredMessageImages } from "./useDeferredMessageImages";

vi.mock("../../../../services/tauri", () => ({
  hydrateClaudeDeferredImage: vi.fn(),
}));

const image: ClaudeDeferredImage = {
  workspacePath: "/workspace-a",
  mediaType: "image/png",
  estimatedByteSize: 700_000,
  reason: "large-inline-image",
  locator: {
    sessionId: "session-1",
    lineIndex: 1,
    blockIndex: 2,
    messageId: "message-1",
    mediaType: "image/png",
  },
};

describe("useDeferredMessageImages", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("owns hydrated object URLs and revokes them on unmount", async () => {
    vi.mocked(hydrateClaudeDeferredImage).mockResolvedValue({
      src: "data:image/png;base64,AAAA",
      mediaType: "image/png",
      byteSize: 3,
      locator: image.locator,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["image"], { type: "image/png" }),
    } as Response);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:owned-image");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const { result, unmount } = renderHook(() => useDeferredMessageImages({
      messageId: "message-1",
      threadId: "thread-1",
      images: [image],
    }));

    await act(async () => {
      await result.current.load(image);
    });

    await waitFor(() => {
      expect(result.current.loadedImages).toEqual([
        { src: "blob:owned-image", label: "Deferred Claude image 1" },
      ]);
    });

    unmount();
    expect(revokeSpy).toHaveBeenCalledWith("blob:owned-image");
  });
});
