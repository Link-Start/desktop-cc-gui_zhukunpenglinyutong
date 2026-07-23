/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("invokes onConfirm from the confirm branch and never onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete all entries?"
        body="This action cannot be undone."
        confirmText="Delete"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete all entries?");
    expect(dialog.textContent).toContain("This action cannot be undone.");

    const confirmButton = within(dialog).getByRole("button", { name: "Delete" });
    // 危险态确认按钮使用 destructive 配色
    expect(confirmButton.className).toContain("bg-destructive");
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("invokes onCancel from the cancel branch and never onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Discard changes?"
        body="Unsaved edits will be lost."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    // 未显式传入文案时回落到 common.confirm / common.cancel
    const cancelButton = within(dialog).getByRole("button", { name: "common.cancel" });
    expect(within(dialog).getByRole("button", { name: "common.confirm" })).toBeTruthy();
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
