// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DshAgentPresetSelect } from "./DshAgentPresetSelect";

const pushErrorToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("../../../../../services/toasts", () => ({
  pushErrorToast: (input: unknown) => pushErrorToast(input),
}));

const queryOption = (presetId: string): HTMLElement | null =>
  document.body.querySelector(`[data-preset-id="${presetId}"]`);

describe("DshAgentPresetSelect", () => {
  it("lets a blank session pick another shipped preset", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    const { container } = render(
      <DshAgentPresetSelect value="standard" onChange={onChange} />,
    );

    const trigger = container.querySelector(".selector-button");
    expect(trigger).toBeTruthy();
    await user.click(trigger as HTMLElement);
    await waitFor(() => {
      expect(queryOption("minimal")).toBeTruthy();
    });

    await user.click(queryOption("minimal") as HTMLElement);
    expect(onChange).toHaveBeenCalledWith("minimal");
  });

  it("locks after the session has started", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    const { container } = render(
      <DshAgentPresetSelect value="code" locked onChange={onChange} />,
    );

    const trigger = container.querySelector(".selector-button");
    expect(trigger?.textContent).toContain("PTC");
    await user.click(trigger as HTMLElement);
    expect(queryOption("standard")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(pushErrorToast).toHaveBeenCalled();
  });
});
