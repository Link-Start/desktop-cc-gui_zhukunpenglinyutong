/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorHabitPreference } from "./EditorHabitPreference";

const setEditorHabit = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/features/onboarding/hooks/useEditorHabit", () => ({
  useEditorHabit: () => ({
    preferredIde: "vscode",
    setEditorHabit,
  }),
}));

describe("EditorHabitPreference", () => {
  it("shows the current editor habit and writes a new one", () => {
    render(<EditorHabitPreference />);
    const select = screen.getByTestId("settings-editor-habit") as HTMLSelectElement;
    expect(select.value).toBe("vscode");
    fireEvent.change(select, { target: { value: "none" } });
    expect(setEditorHabit).toHaveBeenCalledWith("none");
  });
});
