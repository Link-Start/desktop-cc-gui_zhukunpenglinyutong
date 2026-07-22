// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../types";
import { groupSearchResults, SearchPalette } from "./SearchPalette";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === "searchPalette.placeholderFiltered") {
        return `filtered:${params?.content ?? ""}`;
      }
      return key;
    },
  }),
}));

function makeResult(): SearchResult {
  return {
    id: "skill:w-1:wf-thinking",
    kind: "skill",
    title: "/wf-thinking",
    subtitle: "thinking helper",
    score: 10,
    workspaceId: "w-1",
    sourceKind: "skills",
    skillName: "wf-thinking",
    locationLabel: "/skills/wf-thinking",
  };
}

describe("SearchPalette", () => {
  afterEach(() => {
    cleanup();
  });

  it("groups mixed results by kind while preserving flat result indexes", () => {
    const skill = makeResult();
    const firstFile: SearchResult = {
      id: "file:w-1:first.ts",
      kind: "file",
      title: "first.ts",
      score: 20,
    };
    const secondFile: SearchResult = {
      id: "file:w-1:second.ts",
      kind: "file",
      title: "second.ts",
      score: 30,
    };

    expect(groupSearchResults([skill, firstFile, secondFile])).toEqual([
      {
        kind: "file",
        entries: [
          { result: firstFile, resultIndex: 1 },
          { result: secondFile, resultIndex: 2 },
        ],
      },
      { kind: "skill", entries: [{ result: skill, resultIndex: 0 }] },
    ]);
  });

  it("keeps selection and Enter activation bound to the original flat result index", () => {
    const skill = makeResult();
    const file: SearchResult = {
      id: "file:w-1:config.ts",
      kind: "file",
      title: "config.ts",
      score: 20,
    };
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="config"
        results={[skill, file]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getAllByText("searchPalette.typeFile")).toHaveLength(2);
    expect(screen.getAllByText("searchPalette.typeSkill")).toHaveLength(2);
    expect(document.querySelectorAll(".search-palette-result-group-title")).toHaveLength(2);
    expect(screen.getByText(skill.title).closest("button")?.classList.contains("is-active")).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(skill);
  });

  it("does not select result when pressing Enter during IME composition", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "isComposing", { value: true });
    window.dispatchEvent(event);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select result when local composition is active even without event composing flags", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText("searchPalette.inputAria");
    fireEvent.compositionStart(input);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select result when keyCode=229 (IME fallback signal)", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "keyCode", { value: 229 });
    window.dispatchEvent(event);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects current result when pressing Enter outside IME composition", () => {
    const result = makeResult();
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="app"
        results={[result]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith(result);
  });

  it("syncs query from composition end text", () => {
    const onQueryChange = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query=""
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={onQueryChange}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText("searchPalette.inputAria");
    fireEvent.compositionEnd(input, {
      currentTarget: { value: "你好" },
      target: { value: "你好" },
    });

    expect(onQueryChange).toHaveBeenCalledWith("你好");
  });

  it("renders recent results when query is empty", () => {
    const onSelect = vi.fn();
    const stale = makeResult();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query=""
        results={[stale]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(stale.title)).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(stale);
  });

  it("treats invisible-only query as empty and renders supplied recent results", () => {
    const stale = makeResult();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query={"\u200B"}
        results={[stale]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(stale.title)).toBeTruthy();
  });

  it("keeps updating results across multiple composition rounds", () => {
    function Harness() {
      const [query, setQuery] = useState("");
      const dynamicResult: SearchResult = {
        id: "history:dynamic",
        kind: "history",
        title: query || "empty",
        score: 1,
        historyText: query,
      };
      return (
        <SearchPalette
          isOpen
          scope="active-workspace"
          contentFilters={["all"]}
          workspaceName="mossx"
          query={query}
          results={[dynamicResult]}
          selectedIndex={0}
          onQueryChange={setQuery}
          onMoveSelection={() => undefined}
          onSelect={() => undefined}
          onScopeChange={() => undefined}
          onContentFilterToggle={() => undefined}
          onClose={() => undefined}
        />
      );
    }

    render(<Harness />);

    const input = screen.getByLabelText("searchPalette.inputAria");

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "nihao" } });
    expect(screen.getByText("nihao")).toBeTruthy();

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "mossx" } });
    expect(screen.getByText("mossx")).toBeTruthy();

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "search-again" } });
    expect(screen.getByText("search-again")).toBeTruthy();
  });

  it("distinguishes file hydration from a confirmed empty result", () => {
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["files"]}
        query="nested"
        results={[]}
        fileHydrationStatus="loading"
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getAllByText("searchPalette.fileIndexLoading").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("searchPalette.noResults")).toBeNull();
  });

  it("shows partial file-index coverage without hiding available results", () => {
    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["files"]}
        query="app"
        results={[
          {
            id: "file:ws:src/App.tsx",
            kind: "file",
            title: "App.tsx",
            score: 1,
          },
        ]}
        fileHydrationStatus="partial"
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("searchPalette.fileIndexPartial")).toBeTruthy();
    expect(screen.getByText("App.tsx")).toBeTruthy();
  });

  it("distinguishes API disk indexing from a confirmed empty result", () => {
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["apis"]}
        query="/users"
        results={[]}
        apiHydrationStatus="loading"
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getAllByText("searchPalette.apiIndexLoading").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("searchPalette.noResults")).toBeNull();
  });

  it("keeps cached API results visible while the index refreshes", () => {
    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["apis"]}
        query="/api/mobile/pd-sub/v1/plan/product"
        results={[{
          id: "api:w-1:product-page",
          kind: "api",
          title: "POST /api/mobile/pd-sub/v1/plan/product/page",
          score: 100,
          workspaceId: "w-1",
          sourceKind: "apis",
          apiEndpointId: "product-page",
          filePath: "src/ProductController.java",
        }]}
        apiHydrationStatus="refreshing"
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("searchPalette.apiIndexRefreshing")).toBeTruthy();
    expect(
      screen.getByText("POST /api/mobile/pd-sub/v1/plan/product/page"),
    ).toBeTruthy();
    expect(screen.queryByText("searchPalette.apiIndexLoading")).toBeNull();
  });
});
