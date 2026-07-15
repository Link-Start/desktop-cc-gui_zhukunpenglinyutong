// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalImage } from "./LocalImage";

const readLocalImageDataUrlMock = vi.fn();

vi.mock("../../services/tauri", () => ({
  readLocalImageDataUrl: (workspaceId: string, path: string) =>
    readLocalImageDataUrlMock(workspaceId, path),
}));

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
