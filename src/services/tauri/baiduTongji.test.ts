import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  loadBaiduTongjiScript,
  sendBaiduTongjiBeacon,
} from "./baiduTongji";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("Baidu Tongji native bridge", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it("maps the fixed script command payload", async () => {
    await loadBaiduTongjiScript("Mozilla/5.0 WebKit");
    expect(invoke).toHaveBeenCalledWith("load_baidu_tongji_script", {
      userAgent: "Mozilla/5.0 WebKit",
    });
  });

  it("maps the fixed beacon command payload", async () => {
    await sendBaiduTongjiBeacon(
      "https://hm.baidu.com/hm.gif?si=site&hca=visitor",
      "Mozilla/5.0 WebKit",
    );
    expect(invoke).toHaveBeenCalledWith("send_baidu_tongji_beacon", {
      url: "https://hm.baidu.com/hm.gif?si=site&hca=visitor",
      userAgent: "Mozilla/5.0 WebKit",
    });
  });
});
