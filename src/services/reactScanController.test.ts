// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const scanMock = vi.fn();
const internalsMock = {
  instrumentation: { isPaused: { value: true } },
};

vi.mock("react-scan", () => ({
  scan: scanMock,
  ReactScanInternals: internalsMock,
}));

import { setReactScanEnabled } from "./reactScanController";

// react-scan 会把 enabled 持久化到自己的 localStorage 键并在启动时 restore,
// 一旦盘上残留 enabled:false,instrumentation.isPaused 恒真,我们接入的 onRender
// 归因回调会被静默跳过(而面板计时不受影响)。控制器必须主动纠正这两处状态。
describe("reactScanController persisted-pause recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    scanMock.mockClear();
    internalsMock.instrumentation.isPaused.value = true;
  });

  it("rewrites a stale persisted enabled:false before enabling the overlay", async () => {
    window.localStorage.setItem(
      "react-scan-options",
      JSON.stringify({ enabled: false, showToolbar: true }),
    );

    await setReactScanEnabled(true);

    const persisted = JSON.parse(
      window.localStorage.getItem("react-scan-options") ?? "{}",
    );
    expect(persisted.enabled).toBe(true);
    expect(persisted.showToolbar).toBe(true);
    expect(scanMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, dangerouslyForceRunInProduction: true }),
    );
  });

  it("force-resumes instrumentation so onRender attribution records", async () => {
    await setReactScanEnabled(true);

    expect(internalsMock.instrumentation.isPaused.value).toBe(false);
    const options = scanMock.mock.calls.at(-1)?.[0];
    expect(typeof options?.onRender).toBe("function");
  });

  it("leaves instrumentation paused when disabling", async () => {
    await setReactScanEnabled(true);
    internalsMock.instrumentation.isPaused.value = true;

    await setReactScanEnabled(false);

    expect(internalsMock.instrumentation.isPaused.value).toBe(true);
    expect(scanMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
