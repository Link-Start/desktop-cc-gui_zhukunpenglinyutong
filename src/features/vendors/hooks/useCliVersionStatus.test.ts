// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCliVersionStatus } from "@/services/tauri";
import type { CliInstallEngine, CliVersionStatus } from "@/types";
import { useCliVersionStatus } from "./useCliVersionStatus";

vi.mock("@/services/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/services/tauri")>(
    "@/services/tauri",
  );
  return {
    ...actual,
    getCliVersionStatus: vi.fn(),
  };
});

const getCliVersionStatusMock = vi.mocked(getCliVersionStatus);

describe("useCliVersionStatus", () => {
  beforeEach(() => {
    getCliVersionStatusMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not keep a slower previous engine response after switching tabs", async () => {
    let resolveClaude: ((value: CliVersionStatus) => void) | null = null;
    getCliVersionStatusMock.mockImplementation((engine) => {
      if (engine === "claude") {
        return new Promise<CliVersionStatus>((resolve) => {
          resolveClaude = resolve;
        });
      }
      return Promise.resolve({
        engine: "dsh",
        installed: true,
        localVersion: "0.1.0-rc.6",
        latestVersion: "0.1.0-rc.6",
        updateAvailable: false,
        nodeOk: true,
        details: null,
      });
    });

    const { result, rerender } = renderHook(
      ({ engine }: { engine: CliInstallEngine }) =>
        useCliVersionStatus({ engine, enabled: true }),
      { initialProps: { engine: "claude" as CliInstallEngine } },
    );

    await act(async () => {
      rerender({ engine: "dsh" });
    });

    await waitFor(() => {
      expect(result.current.status?.engine).toBe("dsh");
    });

    await act(async () => {
      resolveClaude?.({
        engine: "claude",
        installed: true,
        localVersion: "2.1.226 (Claude Code)",
        latestVersion: "2.1.226",
        updateAvailable: false,
        nodeOk: true,
        details: null,
      });
    });

    expect(result.current.status?.engine).toBe("dsh");
    expect(result.current.status?.localVersion).toBe("0.1.0-rc.6");
  });
});
