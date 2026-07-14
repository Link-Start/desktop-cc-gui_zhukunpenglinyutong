import type { ReactElement, RefObject } from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../components/ui/popover";
import { ThreadDeleteConfirmBubble } from "../../threads/components/ThreadDeleteConfirmBubble";

type ThreadDeleteConfirmPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  trigger: ReactElement;
  threadName: string;
  isDeleting: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
};

export function ThreadDeleteConfirmPopover({
  open,
  anchorRef,
  trigger,
  threadName,
  isDeleting,
  onCancel,
  onConfirm,
}: ThreadDeleteConfirmPopoverProps) {
  // Radix reads the virtual anchor after commit, when the open row ref is assigned.
  const popoverAnchorRef = anchorRef as RefObject<HTMLButtonElement>;

  return (
    <>
      {trigger}
      {open ? (
        <Popover open>
          <PopoverAnchor virtualRef={popoverAnchorRef} />
          <PopoverContent
            side="right"
            align="start"
            sideOffset={10}
            className="thread-delete-popover-shell"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              onCancel?.();
            }}
            onPointerDownOutside={(event) => {
              event.preventDefault();
              onCancel?.();
            }}
          >
            <ThreadDeleteConfirmBubble
              threadName={threadName}
              isDeleting={isDeleting}
              onCancel={() => onCancel?.()}
              onConfirm={() => onConfirm?.()}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}
