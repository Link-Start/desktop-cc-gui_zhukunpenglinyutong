// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProviderContinuationDialog } from "./ProviderContinuationDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
    i18n: { language: "zh-CN" },
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
  retryAction: null,
  detail: null,
  technicalDetail: null,
  sourceEstimatedTokens: 1200,
  packageEstimatedTokens: 600,
  progressPhase: "prepared" as const,
  progressPercent: 32,
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
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows only the token summary instead of omission details", () => {
    render(
      <ProviderContinuationDialog
        state={STATE}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        (_content, node) =>
          node?.textContent?.replace(/\s/g, "") === "1,200→600",
      ),
    ).toBeTruthy();
    expect(screen.getByText("上下文 Token")).toBeTruthy();
    expect(screen.queryByText(/Omissions|省略内容|unsupported/)).toBeNull();
    // Scheme A: no heavy three-step wizard
    expect(screen.queryByText("准备上下文")).toBeNull();
    expect(screen.queryByText("传递上下文")).toBeNull();
    expect(screen.queryByText("校验目标")).toBeNull();
  });

  it("shows preparing status with thin progress and no fake percent label", () => {
    render(
      <ProviderContinuationDialog
        state={{
          ...STATE,
          stage: "preparing",
          sourceEstimatedTokens: null,
          packageEstimatedTokens: null,
          progressPhase: "compiling-context",
          progressPercent: 22,
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "正在整理可续接上下文",
    );
    expect(screen.getByText("正在估算上下文…")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "22",
    );
    expect(screen.queryByText("22%")).toBeNull();
    expect(
      (screen.getByRole("button", {
        name: "正在准备…",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("hides progress bar and token row on error, keeps recovery copy", () => {
    const onConfirm = vi.fn();
    render(
      <ProviderContinuationDialog
        state={{
          ...STATE,
          stage: "error",
          retryAction: "execute",
          sourceEstimatedTokens: null,
          packageEstimatedTokens: null,
          detail:
            "目标会话可能已经创建。重试只会校验同一个会话，不会重复创建。",
          technicalDetail:
            "acceptance-ambiguous: Claude did not echo the context marker",
        }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("续接没有完成")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("不会重复创建");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("上下文 Token")).toBeNull();
    expect(screen.queryByText("正在估算上下文…")).toBeNull();
    const technicalDetails = screen
      .getByText("技术详情")
      .closest("details") as HTMLDetailsElement;
    expect(technicalDetails.open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "重试校验" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("keeps cancel enabled while delivering context so a stuck run can be abandoned", () => {
    const onCancel = vi.fn();
    render(
      <ProviderContinuationDialog
        state={{
          ...STATE,
          stage: "running",
          progressPhase: "delivering-context",
          progressPercent: 68,
        }}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    const cancelButton = screen.getByRole("button", {
      name: "common.cancel",
    }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(false);
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
