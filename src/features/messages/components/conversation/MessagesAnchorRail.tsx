import { useId, useState, type KeyboardEvent } from "react";

type MessageAnchor = {
  description?: string;
  id: string;
  role: string;
  title?: string;
};

type VisibleMessageAnchor = {
  anchor: MessageAnchor;
  originalIndex: number;
  placement: "down" | "center" | "up";
};

type MessagesAnchorRailProps = {
  activeAnchorId: string | null;
  anchors: MessageAnchor[];
  anchorNavigationLabel: string;
  getFallbackTitle: (index: number) => string;
  onScrollToAnchor: (messageId: string) => void;
};

const MAX_VISIBLE_ANCHOR_DASHES = 32;
const PREVIEW_EDGE_ROW_COUNT = 6;

function getVisibleAnchorDashes(
  anchors: MessageAnchor[],
  activeAnchorId: string | null,
): VisibleMessageAnchor[] {
  const activeIndex = activeAnchorId
    ? anchors.findIndex((anchor) => anchor.id === activeAnchorId)
    : -1;
  const visibleAnchorIndexes =
    anchors.length <= MAX_VISIBLE_ANCHOR_DASHES
      ? anchors.map((_, index) => index)
      : Array.from({ length: MAX_VISIBLE_ANCHOR_DASHES }, (_, bucketIndex) => {
          const start = Math.floor(
            (bucketIndex * anchors.length) / MAX_VISIBLE_ANCHOR_DASHES,
          );
          const end = Math.floor(
            ((bucketIndex + 1) * anchors.length) / MAX_VISIBLE_ANCHOR_DASHES,
          );
          const bucketEnd = Math.max(start + 1, end);
          return activeIndex >= start && activeIndex < bucketEnd
            ? activeIndex
            : Math.floor((start + bucketEnd - 1) / 2);
        });

  return visibleAnchorIndexes.map((originalIndex, visibleIndex) => {
    const hasMiddleRows =
      visibleAnchorIndexes.length > PREVIEW_EDGE_ROW_COUNT * 2;
    return {
      anchor: anchors[originalIndex]!,
      originalIndex,
      placement:
        visibleIndex < PREVIEW_EDGE_ROW_COUNT
          ? "down"
          : hasMiddleRows &&
              visibleIndex >= visibleAnchorIndexes.length - PREVIEW_EDGE_ROW_COUNT
            ? "up"
            : "center",
    };
  });
}

export function MessagesAnchorRail({
  activeAnchorId,
  anchors,
  anchorNavigationLabel,
  getFallbackTitle,
  onScrollToAnchor,
}: MessagesAnchorRailProps) {
  const previewId = useId();
  const [previewAnchorId, setPreviewAnchorId] = useState<string | null>(null);

  if (anchors.length === 0) {
    return null;
  }

  const visibleAnchors = getVisibleAnchorDashes(anchors, activeAnchorId);
  const previewAnchorIndex = previewAnchorId
    ? visibleAnchors.findIndex(({ anchor }) => anchor.id === previewAnchorId)
    : -1;

  const handleJump = (messageId: string) => {
    setPreviewAnchorId(null);
    onScrollToAnchor(messageId);
  };

  const handleDashKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    messageId: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleJump(messageId);
  };

  return (
    <div
      className="messages-anchor-rail"
      role="navigation"
      aria-label={anchorNavigationLabel}
      onMouseLeave={() => setPreviewAnchorId(null)}
    >
      {visibleAnchors.map(
        ({ anchor, originalIndex, placement }, visibleIndex) => {
          const isActive = activeAnchorId === anchor.id;
          const isPreviewVisible = previewAnchorId === anchor.id;
          const previewDistance =
            previewAnchorIndex < 0
              ? -1
              : Math.abs(visibleIndex - previewAnchorIndex);
          const proximityClass =
            previewDistance >= 0 && previewDistance <= 3
              ? ` is-proximity-${previewDistance}`
              : "";
          const label = anchor.title?.trim() || getFallbackTitle(originalIndex);
          return (
            <div
              key={anchor.id}
              className={`messages-anchor-item is-preview-${placement}`}
            >
              <button
                type="button"
                className={`messages-anchor-dash${isActive ? " is-active" : ""}${proximityClass}`}
                onMouseEnter={() => setPreviewAnchorId(anchor.id)}
                onFocus={() => setPreviewAnchorId(anchor.id)}
                onBlur={() => setPreviewAnchorId(null)}
                onClick={() => handleJump(anchor.id)}
                onKeyDown={(event) => handleDashKeyDown(event, anchor.id)}
                aria-current={isActive ? "location" : undefined}
                aria-describedby={isPreviewVisible ? previewId : undefined}
                aria-label={label}
                title={label}
                data-anchor-id={anchor.id}
                data-testid="messages-anchor-dash"
              />
              {isPreviewVisible ? (
                <div
                  id={previewId}
                  className="messages-anchor-preview"
                  role="tooltip"
                  data-testid="messages-anchor-preview"
                >
                  <strong className="messages-anchor-preview-title">
                    {originalIndex + 1}. {label}
                  </strong>
                  {anchor.description ? (
                    <span className="messages-anchor-preview-description">
                      {anchor.description}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      )}
    </div>
  );
}
