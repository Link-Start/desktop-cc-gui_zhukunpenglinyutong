// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { downloadMermaidPngMock, viewerConstructorMock } = vi.hoisted(() => ({
  downloadMermaidPngMock: vi.fn(),
  viewerConstructorMock: vi.fn().mockImplementation(
    (_element: HTMLImageElement, options: { shown?: () => void }) => ({
      show: vi.fn(() => options.shown?.()),
      destroy: vi.fn(),
      update: vi.fn(),
    }),
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "common.markdownMermaidDownloadPng": "Download PNG",
      "common.markdownMermaidDownloadingPng": "Downloading PNG…",
      "common.markdownMermaidDownloadFailed": "PNG download failed.",
    })[key] ?? key,
  }),
}));

vi.mock("viewerjs", () => ({ default: viewerConstructorMock }));
vi.mock("./downloadMermaidPng", () => ({
  downloadMermaidPng: downloadMermaidPngMock,
}));

import MermaidFullscreenViewer from "./MermaidFullscreenViewer";
import { destroyActiveViewer } from "./activeViewer";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" />';

afterEach(() => {
  destroyActiveViewer();
  vi.clearAllMocks();
});

describe("MermaidFullscreenViewer PNG download", () => {
  it("shows one shared control and suppresses concurrent downloads", async () => {
    let finishDownload: (() => void) | undefined;
    downloadMermaidPngMock.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishDownload = resolve;
      }),
    );
    render(<MermaidFullscreenViewer open svg={SVG} onClose={() => undefined} />);
    await waitFor(() => expect(viewerConstructorMock).toHaveBeenCalledTimes(1));
    expect(viewerConstructorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ zIndex: 1300 }),
    );

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Download PNG",
    });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(downloadMermaidPngMock).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Downloading PNG…");

    finishDownload?.();
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("keeps the viewer open and exposes localized feedback on failure", async () => {
    const onClose = vi.fn();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    downloadMermaidPngMock.mockRejectedValueOnce(new Error("canvas failed"));
    render(<MermaidFullscreenViewer open svg={SVG} onClose={onClose} />);
    await waitFor(() => expect(viewerConstructorMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    expect((await screen.findByRole("alert")).textContent).toContain("PNG download failed.");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Download PNG" }).disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("mermaid-fullscreen-img")).toBeTruthy();
  });
});
