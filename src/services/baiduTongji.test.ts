// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installBaiduTongji } from "./baiduTongji";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ label: "main" })),
}));

const mockWindowLabel = (label: string) => {
  vi.mocked(getCurrentWindow).mockReturnValue({ label } as ReturnType<
    typeof getCurrentWindow
  >);
};

describe("installBaiduTongji", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document
      .querySelectorAll('script[src*="hm.baidu.com"]')
      .forEach((el) => el.remove());
    delete window._hmt;
  });

  it("开发环境不注入统计脚本", () => {
    vi.stubEnv("PROD", false);
    installBaiduTongji();
    expect(document.querySelector('script[src*="hm.baidu.com"]')).toBeNull();
  });

  it("生产环境注入带站点 ID 的统计脚本", () => {
    vi.stubEnv("PROD", true);
    installBaiduTongji();
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="hm.baidu.com"]',
    );
    expect(script?.src).toContain(
      "hm.js?daa60bcc45c658ee35054b93be3cf2e4",
    );
    expect(script?.async).toBe(true);
    expect(window._hmt).toEqual([]);
  });

  it("非主窗口不注入统计脚本，避免开窗虚增 PV", () => {
    vi.stubEnv("PROD", true);
    mockWindowLabel("about");
    installBaiduTongji();
    expect(document.querySelector('script[src*="hm.baidu.com"]')).toBeNull();
  });
});
