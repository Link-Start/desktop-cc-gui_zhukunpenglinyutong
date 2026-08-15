// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalImage } from "./LocalImage";

const readLocalImageDataUrlMock = vi.fn();

vi.mock("../../services/tauri", () => ({
  readLocalImageDataUrl: (workspaceId: string, path: string) =>
    readLocalImageDataUrlMock(workspaceId, path),
}));

describe("LocalImage decoding hint", () => {
  it("defaults decoding to async so decode stays off the main thread", () => {
    render(<LocalImage src="asset://localhost/tmp/a.png" alt="decode-default" />);
    expect(screen.getByAltText("decode-default").getAttribute("decoding")).toBe("async");
  });

  it("lets callers override the decoding hint", () => {
    render(<LocalImage src="asset://localhost/tmp/a.png" alt="decode-override" decoding="sync" />);
    expect(screen.getByAltText("decode-override").getAttribute("decoding")).toBe("sync");
  });
});

describe("LocalImage resolved-source cache", () => {
  beforeEach(() => {
    readLocalImageDataUrlMock.mockReset();
  });

  it("reuses the resolved data-url on remount without a blank refetch", async () => {
    readLocalImageDataUrlMock.mockResolvedValueOnce("data:image/png;base64,CACHED");
    const props = {
      src: "asset://localhost/Users/test/images/remount-cache.png",
      workspaceId: "ws-cache",
      localPath: "/Users/test/images/remount-cache.png",
      alt: "cache-demo",
    };

    const { unmount } = render(<LocalImage {...props} />);
    fireEvent.error(screen.getByAltText("cache-demo"));
    await waitFor(() => {
      expect(
        (screen.getByAltText("cache-demo") as HTMLImageElement).src,
      ).toContain("CACHED");
    });

    unmount();
    readLocalImageDataUrlMock.mockClear();

    // Remount with identical props: the cached data-url must be applied
    // synchronously (no blank asset src) and no fallback refetch should fire.
    render(<LocalImage {...props} />);
    const remounted = screen.getByAltText("cache-demo") as HTMLImageElement;
    expect(remounted.src).toContain("CACHED");
    expect(readLocalImageDataUrlMock).not.toHaveBeenCalled();
  });
});
