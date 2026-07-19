export type ConversationSelectionSnapshot = {
  text: string;
  itemIds: string[];
};

function isNodeInside(root: HTMLElement, node: Node | null): boolean {
  return node === root || (node ? root.contains(node) : false);
}

export function snapshotConversationSelection(
  selection: Selection | null,
  canvasRoot: HTMLElement | null,
): ConversationSelectionSnapshot | null {
  if (
    !selection ||
    !canvasRoot ||
    selection.isCollapsed ||
    selection.rangeCount === 0 ||
    !isNodeInside(canvasRoot, selection.anchorNode) ||
    !isNodeInside(canvasRoot, selection.focusNode)
  ) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const itemIds = Array.from(
    canvasRoot.querySelectorAll<HTMLElement>("[data-message-anchor-id]"),
  )
    .filter((node) => {
      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    })
    .map((node) => node.dataset.messageAnchorId?.trim() ?? "")
    .filter((itemId, index, all) => itemId.length > 0 && all.indexOf(itemId) === index)
    .slice(0, 128);

  return itemIds.length > 0 ? { text, itemIds } : null;
}
