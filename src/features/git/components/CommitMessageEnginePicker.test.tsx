// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitMessageEnginePicker } from "./CommitMessageEnginePicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const translations: Record<string, string> = {
        "git.generateCommitMessage": "Generate commit message",
        "git.generateCommitMessageLastConfig": "Use last configuration",
        "git.generateCommitMessageWithConfig": "Generate with this config",
        "git.commitMessageAvailableEngines": "Engines",
        "common.language": "Language",
        "settings.languageChinese": "中文",
        "settings.languageEnglish": "English",
        "settings.cliGroupEnabledEmpty": "No enabled engines",
      };
      if (key === "settings.cliGroupEnabled") {
        return `Enabled (${options?.count ?? 0})`;
      }
      return translations[key] ?? key;
    },
  }),
}));

afterEach(cleanup);

const engines = [
  "claude",
  "codex",
  "grok",
  "kimi",
  "opencode",
] as const;

describe("CommitMessageEnginePicker", () => {
  it("shows every visible engine in one panel", () => {
    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={null}
        onGenerate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    for (const engineName of [
      "Claude Code",
      "Codex",
      "Grok",
      "Kimi",
      "OpenCode",
    ]) {
      expect(screen.getByRole("radio", { name: engineName })).toBeTruthy();
    }
  });

  it("selects language and engine, then generates via explicit CTA", () => {
    const onGenerate = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={null}
        onGenerate={onGenerate}
        onDismiss={onDismiss}
      />,
    );

    const englishButton = screen.getByRole("button", { name: "English" });
    const chineseButton = screen.getByRole("button", { name: "中文" });
    expect(chineseButton.getAttribute("aria-pressed")).toBe("true");
    expect(englishButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.mouseDown(englishButton);
    fireEvent.click(englishButton);

    expect(englishButton.getAttribute("aria-pressed")).toBe("true");
    expect(chineseButton.getAttribute("aria-pressed")).toBe("false");
    expect(englishButton.getAttribute("data-selected")).toBe("true");

    // Selecting an engine alone must not generate.
    fireEvent.click(screen.getByRole("radio", { name: "Kimi" }));
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate with this config" }),
    );

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onGenerate).toHaveBeenCalledWith("en", "kimi");
  });

  it("puts last configuration next to the generate action in the footer", () => {
    const onGenerate = vi.fn();

    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={{ engine: "grok", language: "en" }}
        onGenerate={onGenerate}
        onDismiss={vi.fn()}
      />,
    );

    const lastConfig = screen.getByRole("button", {
      name: /Use last configuration/,
    });
    const generate = screen.getByRole("button", {
      name: "Generate with this config",
    });
    const engineList = screen.getByRole("radiogroup", { name: "Engines" });

    // Last-config lives in the footer pair, not inside the engine list.
    expect(engineList.contains(lastConfig)).toBe(false);
    expect(lastConfig.compareDocumentPosition(generate)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    fireEvent.click(lastConfig);
    expect(onGenerate).toHaveBeenCalledWith("en", "grok");
  });

  it("disables last configuration when no previous generation exists", () => {
    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={null}
        onGenerate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: /Use last configuration/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
