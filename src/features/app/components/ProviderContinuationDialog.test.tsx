// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProviderContinuationDialog } from "./ProviderContinuationDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
  }),
}));

const STATE = {
  workspaceId: "ws-1",
  sourceSessionId: "claude:source",
  sourceTitle: "修复登录问题",
  sourceLabel: "Claude Code · Provider A",
  destinationLabel: "Codex CLI · Provider B",
  request: {
    workspaceId: "ws-1",
    operationId: "operation-1",
    source: {
      sessionId: "claude:source",
      nativeSessionId: "source",
      engine: "claude" as const,
    },
    destination: {
      engine: "codex" as const,
      providerProfileId: "provider-b",
    },
  },
  operationKey: "key",
  stage: "confirm" as const,
  detail: null,
  technicalDetail: null,
  degradedAccepted: false,
};

describe("ProviderContinuationDialog", () => {
  it("shows readable source and target before creating side effects", () => {
    const onConfirm = vi.fn();
    render(
      <ProviderContinuationDialog
        state={STATE}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("修复登录问题")).toBeTruthy();
    expect(screen.getByText("Claude Code · Provider A")).toBeTruthy();
    expect(screen.getByText("Codex CLI · Provider B")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "创建续接会话" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders degraded evidence in-product", () => {
    render(
      <ProviderContinuationDialog
        state={{
          ...STATE,
          stage: "confirm-degraded",
          detail: "Mode: checkpoint\nOmissions:\n- image",
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Mode: checkpoint",
    );
    expect(
      screen.getByRole("button", { name: "接受降级并继续" }),
    ).toBeTruthy();
  });

  it("keeps recovery copy readable and technical detail collapsed", () => {
    const onConfirm = vi.fn();
    render(
      <ProviderContinuationDialog
        state={{
          ...STATE,
          stage: "error",
          detail:
            "目标会话可能已经创建。重试只会校验同一个会话，不会重复创建。",
          technicalDetail:
            "acceptance-ambiguous: Claude did not echo the context marker",
        }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("不会重复创建");
    const technicalDetails = screen
      .getByText("技术详情")
      .closest("details") as HTMLDetailsElement;
    expect(technicalDetails.open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "重试校验" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
