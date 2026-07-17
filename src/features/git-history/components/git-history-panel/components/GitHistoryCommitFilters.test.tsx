/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHistoryCommitFilters } from "./GitHistoryCommitFilters";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultValues = {
  query: "",
  author: "",
  datePreset: "all" as const,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GitHistoryCommitFilters", () => {
  it("publishes the latest text drafts once after 300ms", () => {
    vi.useFakeTimers();
    const onFiltersChange = vi.fn();

    render(
      <GitHistoryCommitFilters
        headerTitle="Commits"
        draftScopeKey="workspace-1"
        values={defaultValues}
        selectedBranch="all"
        currentBranch="main"
        branchOptions={[
          { value: "all", label: "All" },
          { value: "main", label: "main" },
        ]}
        authorSuggestions={["tester", "tester@example.com"]}
        onFiltersChange={onFiltersChange}
        onBranchChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("git.historyFilterQueryLabel"), {
      target: { value: "fix renderer" },
    });
    fireEvent.change(screen.getByLabelText("git.historyFilterAuthorLabel"), {
      target: { value: "tester" },
    });
    act(() => vi.advanceTimersByTime(299));
    expect(onFiltersChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      query: "fix renderer",
      author: "tester",
      datePreset: "all",
    });
  });

  it("publishes current drafts with immediate pickers and exposes clear", () => {
    const onFiltersChange = vi.fn();
    const onBranchChange = vi.fn();
    const onClear = vi.fn();

    render(
      <GitHistoryCommitFilters
        headerTitle="Commits"
        draftScopeKey="workspace-1"
        values={defaultValues}
        selectedBranch="all"
        currentBranch="main"
        branchOptions={[
          { value: "all", label: "All" },
          { value: "main", label: "main" },
        ]}
        authorSuggestions={[]}
        onFiltersChange={onFiltersChange}
        onBranchChange={onBranchChange}
        onClear={onClear}
      />,
    );

    fireEvent.change(screen.getByLabelText("git.historyFilterQueryLabel"), {
      target: { value: "abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "git.historyFilterDateLabel" }));
    fireEvent.click(
      screen.getByRole("option", { name: /git\.historyFilterDateLast7Days/ }),
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      query: "abc123",
      author: "",
      datePreset: "7d",
    });

    fireEvent.click(screen.getByRole("button", { name: "git.historyFilterBranchLabel" }));
    fireEvent.click(screen.getByRole("option", { name: /main/ }));
    expect(onBranchChange).toHaveBeenCalledWith("main");
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      query: "abc123",
      author: "",
      datePreset: "all",
    });

    fireEvent.click(screen.getByRole("button", { name: "git.historyFilterClear" }));
    expect(onClear).toHaveBeenCalledTimes(1);

    const filterRow = document.querySelector(".git-history-filter-row");
    const filterHeader = filterRow?.closest(".git-history-column-header");
    const searchField = screen
      .getByLabelText("git.historyFilterQueryLabel")
      .closest(".git-history-filter-field");
    expect(filterHeader?.contains(screen.getByText("Commits"))).toBe(true);
    expect(filterHeader?.contains(filterRow as Node)).toBe(true);
    expect(filterHeader?.nextElementSibling).toBe(searchField);
    expect(searchField?.closest(".git-history-column-header")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "git.historyFilterDateLabel" })
        .closest(".git-history-create-pr-picker")
        ?.classList.contains("is-dropdown-end"),
    ).toBe(true);
  });

  it("cancels pending drafts when clear runs before debounce settles", () => {
    vi.useFakeTimers();
    const onFiltersChange = vi.fn();
    const onClear = vi.fn();

    render(
      <GitHistoryCommitFilters
        headerTitle="Commits"
        draftScopeKey="workspace-1"
        values={defaultValues}
        selectedBranch="all"
        currentBranch="main"
        branchOptions={[{ value: "all", label: "All" }]}
        authorSuggestions={[]}
        onFiltersChange={onFiltersChange}
        onBranchChange={vi.fn()}
        onClear={onClear}
      />,
    );

    const queryInput = screen.getByLabelText("git.historyFilterQueryLabel");
    fireEvent.change(queryInput, { target: { value: "stale query" } });
    fireEvent.click(screen.getByRole("button", { name: "git.historyFilterClear" }));

    expect((queryInput as HTMLInputElement).value).toBe("");
    expect(onClear).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it("cancels pending drafts when workspace scope changes", () => {
    vi.useFakeTimers();
    const onFiltersChange = vi.fn();
    const sharedProps = {
      headerTitle: "Commits",
      values: defaultValues,
      selectedBranch: "all",
      currentBranch: "main",
      branchOptions: [{ value: "all", label: "All" }],
      authorSuggestions: [],
      onFiltersChange,
      onBranchChange: vi.fn(),
      onClear: vi.fn(),
    };
    const { rerender } = render(
      <GitHistoryCommitFilters {...sharedProps} draftScopeKey="workspace-1" />,
    );

    const queryInput = screen.getByLabelText("git.historyFilterQueryLabel");
    fireEvent.change(queryInput, { target: { value: "workspace-1 query" } });
    rerender(<GitHistoryCommitFilters {...sharedProps} draftScopeKey="workspace-2" />);

    expect((queryInput as HTMLInputElement).value).toBe("");
    act(() => vi.advanceTimersByTime(300));
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it("labels every control and disables the surface as one unit", () => {
    render(
      <GitHistoryCommitFilters
        headerTitle="Commits"
        draftScopeKey="workspace-1"
        values={defaultValues}
        selectedBranch="all"
        currentBranch={null}
        branchOptions={[{ value: "all", label: "All" }]}
        authorSuggestions={[]}
        disabled
        onFiltersChange={vi.fn()}
        onBranchChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(
      (screen.getByLabelText("git.historyFilterQueryLabel") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("git.historyFilterAuthorLabel") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "git.historyFilterBranchLabel",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "git.historyFilterDateLabel",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const queryInput = screen.getByLabelText(
      "git.historyFilterQueryLabel",
    ) as HTMLInputElement;
    const authorInput = screen.getByLabelText(
      "git.historyFilterAuthorLabel",
    ) as HTMLInputElement;
    expect(queryInput.name).toBe("git-history-commit-query");
    expect(queryInput.autocomplete).toBe("off");
    expect(queryInput.getAttribute("spellcheck")).toBe("false");
    expect(authorInput.name).toBe("git-history-commit-author");
    expect(authorInput.autocomplete).toBe("off");
    expect(authorInput.getAttribute("spellcheck")).toBe("false");
  });
});
