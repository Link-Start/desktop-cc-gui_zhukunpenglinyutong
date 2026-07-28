// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProviderContinuationContextCard } from "./ProviderContinuationContextCard";

const TARGET = {
  id: "codex:target",
  name: "继续：修复登录问题",
  updatedAt: 2,
  engineSource: "codex" as const,
  providerProfileName: "Provider B",
  originKind: "provider-continuation",
  sourceSessionId: "claude:source",
};

describe("ProviderContinuationContextCard", () => {
  it("shows readable lineage and opens the source", () => {
    const onOpenSource = vi.fn();
    render(
      <ProviderContinuationContextCard
        thread={TARGET}
        source={{
          id: "claude:source",
          name: "修复登录问题",
          updatedAt: 1,
          engineSource: "claude",
          providerProfileName: "Provider A",
        }}
        onOpenSource={onOpenSource}
      />,
    );

    const details = screen.getByRole("group", {
      name: "Provider 续接上下文",
    }) as HTMLDetailsElement;
    const summary = details.querySelector("summary") as HTMLElement;
    expect(details.open).toBe(false);
    expect(details.className.split(" ")).toEqual(
      expect.arrayContaining([
        "provider-continuation-context-card",
        "sticky",
        "top-[calc(var(--main-topbar-height)+12px)]",
        "z-10",
        "bg-muted",
      ]),
    );
    expect(details.textContent).toContain("Claude Code · Provider A");
    expect(details.textContent).toContain("Codex CLI · Provider B");
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    const openSourceButton = screen.getByRole("button", {
      name: "查看来源会话",
    });
    expect(openSourceButton.textContent).toBe("");
    expect(openSourceButton.className.split(" ")).toEqual(
      expect.arrayContaining([
        "size-7",
        "border-0",
        "bg-transparent",
        "p-0",
      ]),
    );
    fireEvent.click(openSourceButton);
    expect(onOpenSource).toHaveBeenCalledOnce();
    fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("keeps frozen target identity when the source is missing", () => {
    render(
      <ProviderContinuationContextCard
        thread={TARGET}
        source={null}
        onOpenSource={null}
      />,
    );

    expect(screen.getByText(/来源会话已不可用/)).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Provider 续接上下文" }).textContent,
    ).toContain("Claude Code · 来源 Provider");
    expect(
      (
        screen.getByRole("button", {
          name: "查看来源会话",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
