/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

afterEach(cleanup);

describe("UnsavedChangesDialog", () => {
  it("disables every close decision while an external save is in flight", () => {
    render(
      <UnsavedChangesDialog
        open
        isSaving
        onContinueEditing={vi.fn()}
        onDiscard={vi.fn()}
        onSaveAndClose={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "files.saving" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "files.continueEditing" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "files.discardChangesAction" }).disabled).toBe(true);
  });
});
