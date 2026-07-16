// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readClaudeSettingsJson, saveClaudeSettingsJson } from "../../../services/tauri";
import { ClaudeSettingsJsonDialog } from "./ClaudeSettingsJsonDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../services/tauri", () => ({
  readClaudeSettingsJson: vi.fn(),
  saveClaudeSettingsJson: vi.fn(),
}));

describe("ClaudeSettingsJsonDialog", () => {
  it("uses an editor-like layout for the official settings JSON", async () => {
    vi.mocked(readClaudeSettingsJson).mockResolvedValueOnce('{\n  "model": "opus"\n}');

    const { container } = render(
      <ClaudeSettingsJsonDialog
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const editor = await screen.findByRole("textbox", {
      name: "settings.vendor.localProviderDescription",
    });
    expect(editor.classList.contains("vendor-official-json-editor")).toBe(true);

    const heading = container.querySelector(".vendor-official-json-heading");
    expect(heading?.textContent).toContain(
      "settings.vendor.localProviderDescription",
    );
    expect(
      heading?.querySelector(".vendor-json-toolbar button")?.textContent,
    ).toBe("settings.vendor.dialog.formatJson");
  });

  it("inserts two-space indentation when Tab is pressed in the editor", async () => {
    vi.mocked(readClaudeSettingsJson).mockResolvedValueOnce('{"model":"opus"}');
    vi.mocked(saveClaudeSettingsJson).mockResolvedValueOnce(undefined);

    render(
      <ClaudeSettingsJsonDialog
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const editor = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "settings.vendor.localProviderDescription",
    });
    fireEvent.change(editor, { target: { value: "{\n}" } });
    editor.setSelectionRange(2, 2);
    fireEvent.keyDown(editor, { key: "Tab" });

    await waitFor(() => {
      expect(editor.value).toBe("{\n  }");
    });
  });
});
