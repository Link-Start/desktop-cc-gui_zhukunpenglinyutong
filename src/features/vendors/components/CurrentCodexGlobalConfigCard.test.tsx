// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  writeGlobalCodexAuthJson,
  writeGlobalCodexConfigToml,
} from "../../../services/tauri";
import { CurrentCodexGlobalConfigCard } from "./CurrentCodexGlobalConfigCard";

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/tauri")
  >("../../../services/tauri");
  return {
    ...actual,
    writeGlobalCodexAuthJson: vi.fn(),
    writeGlobalCodexConfigToml: vi.fn(),
  };
});

const writeGlobalCodexAuthJsonMock = vi.mocked(writeGlobalCodexAuthJson);
const writeGlobalCodexConfigTomlMock = vi.mocked(writeGlobalCodexConfigToml);

function renderCard(options: { onSaved?: () => void } = {}) {
  return render(
    <CurrentCodexGlobalConfigCard
      configLoading={false}
      configExists
      configContent={'model = "gpt-5"\n'}
      configTruncated={false}
      configError={null}
      authLoading={false}
      authExists
      authContent={'{"access_token":"secret"}'}
      authTruncated={false}
      authError={null}
      onSaved={options.onSaved}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CurrentCodexGlobalConfigCard", () => {
  it("keeps Codex config paths inside the edit dialog only", () => {
    const { container } = renderCard();

    expect(screen.getByText("Official Config")).toBeTruthy();
    expect(screen.queryByText("~/.codex/config.toml")).toBeNull();
    expect(screen.queryByText("~/.codex/auth.json")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("~/.codex/config.toml")).toBeTruthy();
    expect(screen.getByText("~/.codex/auth.json")).toBeTruthy();
    expect(
      container.querySelector(".vendor-codex-official-dialog-body"),
    ).toBeTruthy();
  });

  it("saves both Codex official files from the edit dialog", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexAuthJsonMock.mockResolvedValueOnce(undefined);
    writeGlobalCodexConfigTomlMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: 'model = "gpt-5.1"\n' },
    });
    fireEvent.change(authEditor, {
      target: { value: '{"access_token":"next"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(writeGlobalCodexConfigTomlMock).toHaveBeenCalledWith(
        'model = "gpt-5.1"\n',
      );
      expect(writeGlobalCodexAuthJsonMock).toHaveBeenCalledWith(
        '{"access_token":"next"}',
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("masks auth.json secrets by default and reveals them on demand", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const [, authEditor] = screen.getAllByRole("textbox") as HTMLTextAreaElement[];
    expect(authEditor.value).not.toContain("secret");
    expect(authEditor.value).toContain("******");
    expect(authEditor.readOnly).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [, revealedEditor] = screen.getAllByRole(
      "textbox",
    ) as HTMLTextAreaElement[];
    expect(revealedEditor.value).toContain("secret");
    expect(revealedEditor.readOnly).toBe(false);
  });

  it("only writes changed files and never writes an empty auth.json", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexConfigTomlMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: 'model = "gpt-5.2"\n' },
    });
    fireEvent.change(authEditor, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(writeGlobalCodexConfigTomlMock).toHaveBeenCalledWith(
        'model = "gpt-5.2"\n',
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(writeGlobalCodexAuthJsonMock).not.toHaveBeenCalled();
  });

  it("shows a partial failure message when one write fails", async () => {
    const onSaved = vi.fn();
    writeGlobalCodexConfigTomlMock.mockRejectedValueOnce(new Error("disk full"));
    writeGlobalCodexAuthJsonMock.mockResolvedValueOnce(undefined);

    renderCard({ onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Sensitive" }));
    const [configEditor, authEditor] = screen.getAllByRole("textbox");

    fireEvent.change(configEditor, {
      target: { value: "not the same\n" },
    });
    fireEvent.change(authEditor, {
      target: { value: '{"access_token":"next"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to write global config\.toml: disk full/),
      ).toBeTruthy();
    });
    // Dialog stays open so the user can retry the failed write.
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
