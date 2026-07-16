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
});
