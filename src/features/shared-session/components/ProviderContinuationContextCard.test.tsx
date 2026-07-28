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

    expect(screen.getByText("Claude Code · Provider A")).toBeTruthy();
    expect(screen.getByText("Codex CLI · Provider B")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看来源" }));
    expect(onOpenSource).toHaveBeenCalledOnce();
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
    expect(screen.getByText("Claude Code · 来源 Provider")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "查看来源" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
