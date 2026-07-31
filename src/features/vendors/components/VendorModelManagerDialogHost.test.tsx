// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  requestVendorModelManager,
} from "../modelManagerRequest";
import { STORAGE_KEYS } from "../types";
import { VendorModelManagerDialogHost } from "./VendorModelManagerDialogHost";

describe("VendorModelManagerDialogHost", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("opens the model manager dialog on the current page when requested", async () => {
    render(<VendorModelManagerDialogHost />);

    expect(screen.queryByText("settings.vendor.modelManager.title")).toBeNull();

    act(() => {
      requestVendorModelManager({ target: "claude", addMode: true });
    });

    expect(
      await screen.findByText("settings.vendor.modelManager.title"),
    ).toBeTruthy();
    // addMode=true 时直接进入新增表单
    expect(
      screen.getByPlaceholderText(
        "settings.vendor.modelManager.modelIdPlaceholder",
      ),
    ).toBeTruthy();
  });

  it("persists a newly added model into provider storage without settings navigation", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<VendorModelManagerDialogHost />);

    act(() => {
      requestVendorModelManager({ target: "codex", addMode: true });
    });

    await screen.findByPlaceholderText(
      "settings.vendor.modelManager.modelIdPlaceholder",
    );

    await user.type(
      screen.getByPlaceholderText(
        "settings.vendor.modelManager.modelIdPlaceholder",
      ),
      "gpt-custom-1",
    );
    await user.type(
      screen.getByPlaceholderText(
        "settings.vendor.modelManager.modelLabelPlaceholder",
      ),
      "Custom GPT",
    );
    await user.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    await waitFor(() => {
      const stored = window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!) as Array<{ id: string; label: string }>;
      expect(parsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "gpt-custom-1", label: "Custom GPT" }),
        ]),
      );
    });
  });

  it("closes when the dialog close control is used", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<VendorModelManagerDialogHost />);

    act(() => {
      requestVendorModelManager({ target: "claude", addMode: true });
    });

    await screen.findByText("settings.vendor.modelManager.title");
    // header × 与 footer 关闭都叫 common.close,取 footer 主按钮
    const closeButtons = screen.getAllByRole("button", { name: "common.close" });
    await user.click(closeButtons[closeButtons.length - 1]!);

    await waitFor(() => {
      expect(screen.queryByText("settings.vendor.modelManager.title")).toBeNull();
    });
  });
});
