/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceNoteCardPanel } from "./WorkspaceNoteCardPanel";
import {
  WorkspaceNoteCardsLayoutProvider,
  useWorkspaceNoteCardsLayoutController,
} from "./WorkspaceNoteCardsLayoutContext";
import { noteCardsFacade } from "../services/noteCardsFacade";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../../components/common/RichTextInput/RichTextInput", () => ({
  RichTextInput: ({
    value,
    onChange,
    footerLeft,
    footerRight,
  }: {
    value: string;
    onChange: (value: string) => void;
    footerLeft?: ReactNode;
    footerRight?: ReactNode;
  }) => (
    <div>
      <textarea
        data-testid="workspace-note-card-rich-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {footerLeft}
      {footerRight}
    </div>
  ),
}));

vi.mock("../services/noteCardsFacade", () => ({
  noteCardsFacade: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    delete: vi.fn(),
  },
}));

function NoteCardsLayoutHarness({
  children,
  isActive = true,
}: {
  children: ReactNode;
  isActive?: boolean;
}) {
  const controls = useWorkspaceNoteCardsLayoutController(isActive);
  return (
    <WorkspaceNoteCardsLayoutProvider value={controls}>
      {children}
    </WorkspaceNoteCardsLayoutProvider>
  );
}

describe("WorkspaceNoteCardPanel layout maximize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(noteCardsFacade.list).mockResolvedValue({
      items: [],
      total: 0,
    } as never);
  });

  it("toggles maximize without losing an active draft", async () => {
    render(
      <NoteCardsLayoutHarness>
        <WorkspaceNoteCardPanel workspaceId="ws-1" workspaceName="demo" />
      </NoteCardsLayoutHarness>,
    );

    const maximizeButton = screen.getByRole("button", { name: "menu.maximize" });
    expect(maximizeButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "noteCards.new" }));
    const bodyInput = await screen.findByTestId("workspace-note-card-rich-input");
    fireEvent.change(bodyInput, { target: { value: "尚未保存的布局草稿" } });
    fireEvent.click(maximizeButton);

    expect(
      screen.getByRole("button", { name: "common.restore" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect((bodyInput as HTMLTextAreaElement).value).toBe("尚未保存的布局草稿");

    fireEvent.click(screen.getByRole("button", { name: "common.restore" }));
    expect(screen.getByRole("button", { name: "menu.maximize" })).toBeTruthy();
    expect((bodyInput as HTMLTextAreaElement).value).toBe("尚未保存的布局草稿");
  });

  it("hides maximize when the workbench is an editor companion", async () => {
    render(
      <NoteCardsLayoutHarness isActive={false}>
        <WorkspaceNoteCardPanel workspaceId="ws-1" workspaceName="demo" />
      </NoteCardsLayoutHarness>,
    );

    await screen.findByText("noteCards.idleTitle");
    expect(
      screen.queryByRole("button", { name: "menu.maximize" }),
    ).toBeNull();
  });
});
