// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CliCustomPathDialog,
  CliCustomPathEntry,
} from "./CliCustomPathDialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "settings.vendor.customPathTitle": "Custom path",
        "settings.vendor.customPathDescription":
          "Configure the executable used by this CLI.",
        "settings.vendor.customPath": "Custom path",
        "settings.vendor.configurePath": "Configure path",
        "settings.vendor.customPathUsingSystemPath": "Using system PATH",
        "settings.vendor.customPathNoArgs": "No extra args",
        "settings.vendor.cancel": "Cancel",
        "settings.defaultClaudePath": "Default Claude Code path",
        "settings.defaultCodexPath": "Default Codex path",
        "settings.claudePlaceholder": "claude",
        "settings.codexPlaceholder": "codex",
        "settings.browse": "Browse",
        "settings.usePath": "Use PATH",
        "settings.pathResolutionDesc": "Leave empty to use PATH.",
        "settings.defaultCodexArgs": "Default Codex args",
        "settings.codexArgsPlaceholder": "--profile personal",
        "settings.clear": "Clear",
        "settings.codexArgsDesc": "Extra flags before",
        "settings.appServer": "app-server",
        "settings.codexArgsDescSuffix": ".",
        "settings.saving": "Saving...",
        "common.save": "Save",
      };
      return labels[key] ?? key;
    },
  }),
}));

describe("CliCustomPathDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a custom path for non-codex engines", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath={null}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("Default Claude Code path"), {
      target: { value: "/usr/local/bin/claude" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ path: "/usr/local/bin/claude" });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("saves path and args for codex", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CliCustomPathDialog
        isOpen
        engine="codex"
        initialPath="/bin/codex"
        initialArgs="--profile personal"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Default Codex path"), {
      target: { value: "/opt/codex" },
    });
    fireEvent.change(screen.getByLabelText("Default Codex args"), {
      target: { value: "--profile work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        path: "/opt/codex",
        args: "--profile work",
      });
    });
  });

  it("clears path via Use PATH and saves null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath="/bin/claude"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use PATH" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ path: null });
    });
  });

  it("browses for an executable path", async () => {
    vi.mocked(openFileDialog).mockResolvedValueOnce("/picked/claude");
    render(
      <CliCustomPathDialog
        isOpen
        engine="claude"
        initialPath={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/picked/claude")).not.toBeNull();
    });
  });
});

describe("CliCustomPathEntry", () => {
  it("shows system PATH summary when no custom path is set", () => {
    const onConfigure = vi.fn();
    render(<CliCustomPathEntry path={null} onConfigure={onConfigure} />);

    expect(screen.getByText("Using system PATH")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configure path" }));
    expect(onConfigure).toHaveBeenCalled();
  });

  it("shows path and args summary for codex", () => {
    render(
      <CliCustomPathEntry
        path="/bin/codex"
        args="--profile personal"
        showArgsSummary
        onConfigure={vi.fn()}
      />,
    );

    expect(screen.getByText("/bin/codex")).not.toBeNull();
    expect(screen.getByText("--profile personal")).not.toBeNull();
  });
});
