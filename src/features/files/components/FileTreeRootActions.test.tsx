/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTreeRootActions } from "./FileTreeRootActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FileTreeRootActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("replays spin animation when clicking the same action repeatedly", () => {
    const onRefreshFiles = vi.fn();

    render(
      <FileTreeRootActions
        rootLabel="DESKTOP-CC-GUI"
        onRefreshFiles={onRefreshFiles}
        showSpecHubAction={false}
      />,
    );

    const button = screen.getByRole("button", { name: "files.refreshFiles" });

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(button.className).toContain("is-spinning");
    expect(onRefreshFiles).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(button.className).toContain("is-spinning");
    expect(onRefreshFiles).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(button.className).not.toContain("is-spinning");
  });

  it("renders uppercase root label with create and refresh actions but no delete action", () => {
    const onCreateFile = vi.fn();
    const onCreateFolder = vi.fn();
    const onRefreshFiles = vi.fn();

    render(
      <FileTreeRootActions
        rootLabel="desktop-cc-gui"
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onRefreshFiles={onRefreshFiles}
        showSpecHubAction={false}
      />,
    );

    expect(screen.getByText("DESKTOP-CC-GUI")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "files.newFile" }));
    fireEvent.click(screen.getByRole("button", { name: "files.newFolder" }));
    fireEvent.click(screen.getByRole("button", { name: "files.refreshFiles" }));

    expect(onCreateFile).toHaveBeenCalledTimes(1);
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
    expect(onRefreshFiles).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "files.deleteItem" })).toBeNull();
  });
});
