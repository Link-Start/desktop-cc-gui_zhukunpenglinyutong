// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReleaseNotesEntry } from "../hooks/useReleaseNotes";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "update.releaseNotesTitle": "Release Notes",
        "update.releaseNotesSubtitle": "Review every release in one place.",
        "update.releaseNotesEmpty": "No release notes yet.",
        "update.releaseNotesLoading": "Loading release notes…",
        "update.releaseNotesLoadFailed": "Failed to load release notes.",
        "update.releaseNotesEnglish": "English:",
        "update.releaseNotesChinese": "中文：",
        "update.releaseNotesPrev": "Previous",
        "update.releaseNotesNext": "Next",
        "update.releaseNotesPage": `${params?.current} / ${params?.total}`,
        "update.availableAction": "Update available",
        "about.checkForUpdates": "Check for Updates",
        "common.retry": "Retry",
      };
      return translations[key] ?? key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("../../../markdown/components/Markdown", () => ({
  Markdown: ({
    value,
    liveRenderMode,
  }: {
    value: string;
    liveRenderMode?: string;
  }) => (
    <div data-testid="release-markdown" data-live-render-mode={liveRenderMode}>
      {value}
    </div>
  ),
}));

import { ReleaseNotesModal } from "./ReleaseNotesModal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const entries: ReleaseNotesEntry[] = [
  {
    id: "1",
    tagName: "v0.2.4",
    version: "0.2.4",
    title: "v0.2.4",
    dateLabel: "2026/03/02",
    englishBody: "## Features\n- Added changelog modal",
    chineseBody: "## Features\n- 新增版本记录弹窗",
  },
  {
    id: "2",
    tagName: "v0.2.3",
    version: "0.2.3",
    title: "v0.2.3",
    dateLabel: "2026/02/21",
    englishBody: "- Previous release",
    chineseBody: "- 上一个版本",
  },
];

describe("ReleaseNotesModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <ReleaseNotesModal
        isOpen={false}
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders release information and pagination", () => {
    render(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Release Notes")).toBeTruthy();
    expect(screen.getByText("v0.2.4")).toBeTruthy();
    expect(screen.getByText("English:")).toBeTruthy();
    expect(screen.getByText("中文：")).toBeTruthy();
    expect(screen.getAllByTestId("release-markdown")).toHaveLength(2);
    expect(screen.getAllByTestId("release-markdown")[0]?.textContent).toContain("Added changelog modal");
    expect(screen.getAllByTestId("release-markdown")[1]?.textContent).toContain("新增版本记录弹窗");
    expect(
      screen.getAllByTestId("release-markdown").every(
        (node) => node.getAttribute("data-live-render-mode") === "lightweight",
      ),
    ).toBe(true);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("calls pagination handlers", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { rerender } = render(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPrev).toHaveBeenCalledTimes(0);
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={1}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("shows loading and error states", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ReleaseNotesModal
        isOpen
        entries={[]}
        activeIndex={0}
        loading
        error={null}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Loading release notes…")).toBeTruthy();

    rerender(
      <ReleaseNotesModal
        isOpen
        entries={[]}
        activeIndex={0}
        loading={false}
        error="network"
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Failed to load release notes.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not auto-check for updates when opened", () => {
    const onCheckForUpdates = vi.fn();

    render(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        updaterState={{ stage: "idle" }}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onStartUpdate={vi.fn()}
      />,
    );

    expect(onCheckForUpdates).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Check for Updates" }),
    ).toBeTruthy();
  });

  it("checks for updates only when the header button is clicked", () => {
    const onCheckForUpdates = vi.fn();
    const onStartUpdate = vi.fn();

    const { rerender } = render(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        updaterState={{ stage: "idle" }}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onStartUpdate={onStartUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check for Updates" }));
    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);

    rerender(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        updaterState={{ stage: "checking" }}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onStartUpdate={onStartUpdate}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Check for Updates",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    rerender(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        updaterState={{ stage: "available", version: "0.7.13" }}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onStartUpdate={onStartUpdate}
      />,
    );

    expect(screen.queryByRole("button", { name: "Check for Updates" })).toBeNull();
    const badge = screen.getByRole("button", { name: /Update available/i });
    expect(badge.textContent).toContain("v0.7.13");
    fireEvent.click(badge);
    expect(onStartUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows update badge instead of check button when update is available", () => {
    const onCheckForUpdates = vi.fn();

    render(
      <ReleaseNotesModal
        isOpen
        entries={entries}
        activeIndex={0}
        loading={false}
        error={null}
        updaterState={{ stage: "available", version: "0.8.0" }}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRetry={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
        onStartUpdate={vi.fn()}
      />,
    );

    expect(onCheckForUpdates).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Check for Updates" })).toBeNull();
    expect(screen.getByRole("button", { name: /Update available/i })).toBeTruthy();
  });
});
