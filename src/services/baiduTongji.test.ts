// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installBaiduTongji } from "./baiduTongji";
import {
  loadBaiduTongjiScript,
  sendBaiduTongjiBeacon,
} from "./tauri/baiduTongji";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ label: "main" })),
}));

vi.mock("./tauri/baiduTongji", () => ({
  loadBaiduTongjiScript: vi.fn(() => Promise.resolve()),
  sendBaiduTongjiBeacon: vi.fn(() => Promise.resolve()),
}));

const SITE_ID = "daa60bcc45c658ee35054b93be3cf2e4";
const BEACON_URL = `http://hm.baidu.com/hm.gif?si=${SITE_ID}&hca=visitor-1&et=0`;
const originalImage = window.Image;
const originalNavigatorPlatform = window.navigator.platform;
const originalWebServiceRuntime = window.__MOSSX_WEB_SERVICE__;

const setNavigatorPlatform = (platform: string) => {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
};

const mockWindowLabel = (label: string) => {
  vi.mocked(getCurrentWindow).mockReturnValue({ label } as ReturnType<
    typeof getCurrentWindow
  >);
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("installBaiduTongji", () => {
  beforeEach(() => {
    vi.mocked(getCurrentWindow).mockReturnValue({ label: "main" } as ReturnType<
      typeof getCurrentWindow
    >);
    vi.mocked(loadBaiduTongjiScript).mockResolvedValue();
    vi.mocked(sendBaiduTongjiBeacon).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    window.Image = originalImage;
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalNavigatorPlatform,
    });
    if (originalWebServiceRuntime === undefined) {
      delete window.__MOSSX_WEB_SERVICE__;
    } else {
      window.__MOSSX_WEB_SERVICE__ = originalWebServiceRuntime;
    }
    document
      .querySelectorAll('script[src*="hm.baidu.com"]')
      .forEach((element) => element.remove());
    delete window._hmt;
  });

  it("开发环境不初始化 external 或 native 统计", () => {
    vi.stubEnv("PROD", false);
    installBaiduTongji();
    expect(document.querySelector('script[src*="hm.baidu.com"]')).toBeNull();
    expect(loadBaiduTongjiScript).not.toHaveBeenCalled();
    expect(window._hmt).toBeUndefined();
  });

  it("Windows production 保留 external hm.js 注入", () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Win32");

    installBaiduTongji();

    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="hm.baidu.com"]',
    );
    expect(script?.src).toContain(`hm.js?${SITE_ID}`);
    expect(script?.async).toBe(true);
    expect(window._hmt).toEqual([]);
    expect(loadBaiduTongjiScript).not.toHaveBeenCalled();
  });

  it("Linux native production 用 native transport 加载 official script", () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Linux x86_64");

    installBaiduTongji();

    expect(document.querySelector('script[src*="hm.baidu.com"]')).toBeNull();
    expect(window._hmt).toEqual([]);
    expect(loadBaiduTongjiScript).toHaveBeenCalledOnce();
    expect(loadBaiduTongjiScript).toHaveBeenCalledWith(navigator.userAgent);
  });

  it("Linux native 只转发 exact hm.gif，普通 Image 保持浏览器行为", () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Linux x86_64");
    installBaiduTongji();

    const analyticsImage = new Image();
    analyticsImage.src = BEACON_URL;
    const normalImage = new Image();
    normalImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    expect(sendBaiduTongjiBeacon).toHaveBeenCalledOnce();
    expect(sendBaiduTongjiBeacon).toHaveBeenCalledWith(
      BEACON_URL,
      navigator.userAgent,
    );
    expect(normalImage.src).toContain("data:image/gif;base64,");
  });

  it("Linux native transport failure 只记录 warning，不阻塞 bootstrap", async () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Linux x86_64");
    vi.mocked(loadBaiduTongjiScript).mockRejectedValue(
      new Error("native analytics unavailable"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => installBaiduTongji()).not.toThrow();
    await flushPromises();

    expect(warn).toHaveBeenCalledWith(
      "[baidu-tongji] failed to load native analytics script",
      "native analytics unavailable",
    );
  });

  it("Linux Web Service production 保留 external hm.js", () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Linux x86_64");
    window.__MOSSX_WEB_SERVICE__ = true;

    installBaiduTongji();

    expect(
      document.querySelector<HTMLScriptElement>('script[src*="hm.baidu.com"]')
        ?.src,
    ).toContain(`hm.js?${SITE_ID}`);
    expect(loadBaiduTongjiScript).not.toHaveBeenCalled();
  });

  it("非主窗口不初始化统计，避免开窗虚增 PV", () => {
    vi.stubEnv("PROD", true);
    setNavigatorPlatform("Linux x86_64");
    mockWindowLabel("about");

    installBaiduTongji();

    expect(document.querySelector('script[src*="hm.baidu.com"]')).toBeNull();
    expect(loadBaiduTongjiScript).not.toHaveBeenCalled();
    expect(window._hmt).toBeUndefined();
  });
});
