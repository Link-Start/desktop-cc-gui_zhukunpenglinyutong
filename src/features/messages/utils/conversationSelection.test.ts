// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { snapshotConversationSelection } from "./conversationSelection";

function selectBetween(start: Text, startOffset: number, end: Text, endOffset: number): Selection {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  selection?.removeAllRanges();
  selection?.addRange(range);
  if (!selection) {
    throw new Error("Selection unavailable");
  }
  return selection;
}

describe("snapshotConversationSelection", () => {
  it("freezes one selected message row", () => {
    const root = document.createElement("main");
    root.innerHTML = '<article data-message-anchor-id="message-1">hello world</article>';
    document.body.append(root);
    const text = root.querySelector("article")?.firstChild;
    if (!(text instanceof Text)) {
      throw new Error("Missing text node");
    }

    const snapshot = snapshotConversationSelection(selectBetween(text, 0, text, 5), root);

    expect(snapshot).toEqual({ text: "hello", itemIds: ["message-1"] });
    root.remove();
  });

  it("preserves DOM order for a multi-row selection", () => {
    const root = document.createElement("main");
    root.innerHTML = [
      '<article data-message-anchor-id="message-1">first</article>',
      '<article data-message-anchor-id="message-2">second</article>',
    ].join("");
    document.body.append(root);
    const rows = root.querySelectorAll("article");
    const first = rows[0]?.firstChild;
    const second = rows[1]?.firstChild;
    if (!(first instanceof Text) || !(second instanceof Text)) {
      throw new Error("Missing text nodes");
    }

    const snapshot = snapshotConversationSelection(selectBetween(first, 0, second, 6), root);

    expect(snapshot?.itemIds).toEqual(["message-1", "message-2"]);
    expect(snapshot?.text).toContain("first");
    expect(snapshot?.text).toContain("second");
    root.remove();
  });

  it("rejects collapsed and outside selections", () => {
    const root = document.createElement("main");
    const outside = document.createElement("p");
    root.innerHTML = '<article data-message-anchor-id="message-1">inside</article>';
    outside.textContent = "outside";
    document.body.append(root, outside);
    const outsideText = outside.firstChild;
    if (!(outsideText instanceof Text)) {
      throw new Error("Missing outside text node");
    }
    const selection = selectBetween(outsideText, 0, outsideText, 4);

    expect(snapshotConversationSelection(selection, root)).toBeNull();
    selection.collapse(outsideText, 0);
    expect(snapshotConversationSelection(selection, root)).toBeNull();
    root.remove();
    outside.remove();
  });
});
