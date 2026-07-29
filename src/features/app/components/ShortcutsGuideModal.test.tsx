// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import { ShortcutsGuideModal } from "./ShortcutsGuideModal";

const translate = (key: string) => key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

const getAppSettingsMock = vi.fn<() => Promise<Partial<AppSettings>>>();

vi.mock("../../../services/tauri", () => ({
  getAppSettings: () => getAppSettingsMock(),
}));

describe("ShortcutsGuideModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders grouped shortcuts from current settings", async () => {
    getAppSettingsMock.mockResolvedValue({
      composerSendShortcut: "enter",
      newAgentShortcut: "cmd+n",
      toggleGlobalSearchShortcut: "cmd+o",
    });

    render(<ShortcutsGuideModal open onOpenChange={() => {}} />);

    expect(screen.getByText("shortcutsGuide.title")).toBeTruthy();
    // 分组标题
    expect(screen.getByText("shortcutsGuide.groups.sessions")).toBeTruthy();
    expect(screen.getByText("shortcutsGuide.groups.panels")).toBeTruthy();
    expect(screen.getByText("shortcutsGuide.groups.composer")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("settings.newAgent")).toBeTruthy();
    });
    expect(screen.getByText("settings.toggleGlobalSearch")).toBeTruthy();
    // 未配置的条目不展示
    expect(screen.queryByText("settings.saveFile")).toBeNull();
    // 发送/换行动态行与硬编码 Quick Switcher 行始终展示
    expect(screen.getByText("shortcutsGuide.sendMessage")).toBeTruthy();
    expect(screen.getByText("shortcutsGuide.insertNewline")).toBeTruthy();
    expect(screen.getByText("sidebar.quickSwitcher.title")).toBeTruthy();
  });

  it("falls back to default shortcuts before settings load", () => {
    getAppSettingsMock.mockReturnValue(new Promise(() => {}));

    render(<ShortcutsGuideModal open onOpenChange={() => {}} />);

    expect(screen.getByText("settings.openSettings")).toBeTruthy();
    expect(screen.getByText("settings.newAgent")).toBeTruthy();
    expect(screen.getByText("settings.stopActiveRun")).toBeTruthy();
  });

  it("invokes onOpenShortcutsSettings and closes from the footer", async () => {
    getAppSettingsMock.mockResolvedValue({ composerSendShortcut: "enter" });
    const onOpenChange = vi.fn();
    const onOpenShortcutsSettings = vi.fn();

    render(
      <ShortcutsGuideModal
        open
        onOpenChange={onOpenChange}
        onOpenShortcutsSettings={onOpenShortcutsSettings}
      />,
    );

    fireEvent.click(screen.getByText("shortcutsGuide.openSettings"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenShortcutsSettings).toHaveBeenCalledTimes(1);
    // flush 异步 getAppSettings 的状态更新，避免 act 警告
    await act(async () => {});
  });
});
