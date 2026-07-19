// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImagePreviewOverlay } from "./ImagePreviewOverlay";

vi.mock("./LocalImage", () => ({
  LocalImage: ({
    localPath: _localPath,
    workspaceId: _workspaceId,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    localPath?: string | null;
    workspaceId?: string | null;
  }) => <img {...props} />,
}));

describe("ImagePreviewOverlay", () => {
  it("renders through document.body so page stacking contexts cannot cover it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    render(
      <ImagePreviewOverlay
        src="data:image/png;base64,AAAA"
        alt="Attached screenshot"
        onClose={vi.fn()}
      />,
      { container: host },
    );

    expect(host.querySelector(".image-preview-overlay")).toBeNull();
    expect(document.body.querySelector(".image-preview-overlay")).toBe(
      screen.getByRole("dialog", { name: "Attached screenshot" }),
    );
  });

  it("closes from Escape and the overlay backdrop", () => {
    const onClose = vi.fn();

    render(
      <ImagePreviewOverlay
        src="data:image/png;base64,AAAA"
        alt="Attached screenshot"
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog", { name: "Attached screenshot" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
