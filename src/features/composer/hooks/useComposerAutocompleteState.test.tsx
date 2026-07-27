/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposerAutocompleteState } from "./useComposerAutocompleteState";

type HookArgs = {
  text: string;
  selectionStart: number | null;
};

function renderAutocompleteState(initialArgs: HookArgs) {
  const setText = vi.fn();
  const setSelectionStart = vi.fn();
  const view = renderHook(
    (args: HookArgs) =>
      useComposerAutocompleteState({
        text: args.text,
        selectionStart: args.selectionStart,
        setText,
        setSelectionStart,
      }),
    { initialProps: initialArgs },
  );
  return { ...view, setText, setSelectionStart };
}

describe("useComposerAutocompleteState", () => {
  describe("isAutocompleteOpen trigger context detection", () => {
    it("activates for each completion trigger at line start", () => {
      for (const trigger of ["/", "$", "@", "@@", "@#"]) {
        const text = `${trigger}que`;
        const { result, unmount } = renderAutocompleteState({
          text,
          selectionStart: text.length,
        });
        expect(result.current.isAutocompleteOpen).toBe(true);
        unmount();
      }
    });

    it("activates after whitespace and bracket prefixes", () => {
      for (const prefix of ["hello ", "see (", 'say "', "list [", "{"]) {
        const text = `${prefix}@src`;
        const { result, unmount } = renderAutocompleteState({
          text,
          selectionStart: text.length,
        });
        expect(result.current.isAutocompleteOpen).toBe(true);
        unmount();
      }
    });

    it("stays inactive without a trigger", () => {
      const { result } = renderAutocompleteState({
        text: "plain message",
        selectionStart: 13,
      });
      expect(result.current.isAutocompleteOpen).toBe(false);
    });

    it("stays inactive when trigger follows a non-boundary character", () => {
      const text = "email me at user@host";
      const { result } = renderAutocompleteState({
        text,
        selectionStart: text.length,
      });
      expect(result.current.isAutocompleteOpen).toBe(false);
    });

    it("stays inactive once the query contains whitespace", () => {
      const text = "/review src";
      const { result } = renderAutocompleteState({
        text,
        selectionStart: text.length,
      });
      expect(result.current.isAutocompleteOpen).toBe(false);
    });

    it("stays inactive when selection is null or at position zero", () => {
      const { result, rerender } = renderAutocompleteState({
        text: "@src",
        selectionStart: null,
      });
      expect(result.current.isAutocompleteOpen).toBe(false);
      rerender({ text: "@src", selectionStart: 0 });
      expect(result.current.isAutocompleteOpen).toBe(false);
    });

    it("prefers multi-character triggers over the single @ trigger", () => {
      const text = "@@mem";
      const { result, unmount } = renderAutocompleteState({
        text,
        selectionStart: text.length,
      });
      expect(result.current.isAutocompleteOpen).toBe(true);
      unmount();

      const noteCardText = "@#card";
      const second = renderAutocompleteState({
        text: noteCardText,
        selectionStart: noteCardText.length,
      });
      expect(second.result.current.isAutocompleteOpen).toBe(true);
      second.unmount();
    });

    it("tracks context as the cursor moves in and out of a trigger", () => {
      const text = "hello @src";
      const { result, rerender } = renderAutocompleteState({
        text,
        selectionStart: text.length,
      });
      expect(result.current.isAutocompleteOpen).toBe(true);
      rerender({ text, selectionStart: 5 });
      expect(result.current.isAutocompleteOpen).toBe(false);
    });
  });

  describe("text and selection passthrough", () => {
    it("handleTextChange forwards text and cursor to setters", () => {
      const { result, setText, setSelectionStart } = renderAutocompleteState({
        text: "",
        selectionStart: null,
      });
      act(() => {
        result.current.handleTextChange("next", 4);
      });
      expect(setText).toHaveBeenCalledWith("next");
      expect(setSelectionStart).toHaveBeenCalledWith(4);
    });

    it("handleSelectionChange forwards cursor to setSelectionStart", () => {
      const { result, setText, setSelectionStart } = renderAutocompleteState({
        text: "",
        selectionStart: null,
      });
      act(() => {
        result.current.handleSelectionChange(7);
      });
      expect(setSelectionStart).toHaveBeenCalledWith(7);
      expect(setText).not.toHaveBeenCalled();
    });
  });
});
