// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AppSettings, CodexDoctorResult } from "../../../types";
import type { DshHostEnsureResult } from "../../../services/tauri";
import { DshConnectionPanel } from "./DshConnectionPanel";

const { runDshDoctorMock, ensureDshHostMock, cancelDshHostMock } = vi.hoisted(() => ({
  runDshDoctorMock: vi.fn(),
  ensureDshHostMock: vi.fn(),
  cancelDshHostMock: vi.fn(),
}));

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri")>(
    "../../../services/tauri",
  );
  return {
    ...actual,
    runDshDoctor: runDshDoctorMock,
    ensureDshHost: ensureDshHostMock,
    cancelDshHost: cancelDshHostMock,
  };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

const openUrlMock = vi.mocked(openUrl);

function connectedDoctor(): CodexDoctorResult {
  return {
    ok: true,
    codexBin: "dsh",
    version: "0.1.0-rc.6",
    appServerOk: true,
    details: null,
    path: null,
    nodeOk: true,
    nodeVersion: "v22.22.3",
    nodeDetails: null,
    hostDescribe: {
      ok: true,
      origin: "http://127.0.0.1:3080",
      describe: {
        provider: "grok",
        model: "grok-4.6",
        attachedSessions: 31,
      },
    },
  };
}

function renderPanel(appSettings: Partial<AppSettings> = {}) {
  const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
  render(
    <DshConnectionPanel
      active
      appSettings={
        {
          dshBin: null,
          dshHost: "127.0.0.1",
          dshPort: 3080,
          dshAutoStart: true,
          ...appSettings,
        } as AppSettings
      }
      customPathEntry={<div>custom-path</div>}
      onUpdateAppSettings={onUpdateAppSettings}
    />,
  );
  return { onUpdateAppSettings };
}

describe("DshConnectionPanel", () => {
  beforeEach(() => {
    runDshDoctorMock.mockResolvedValue(connectedDoctor());
    ensureDshHostMock.mockResolvedValue({
      origin: "http://127.0.0.1:3080",
      host: "127.0.0.1",
      port: 3080,
      ownership: "adopted",
      describe: { provider: "grok", model: "grok-4.6", attachedSessions: 31 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("leads with connected host facts and opens the DSH UI", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("settings.vendor.dshHostConnected")).toBeTruthy();
    });
    expect(runDshDoctorMock).toHaveBeenCalled();
    expect(screen.getByText("grok")).toBeTruthy();
    expect(screen.getByText("grok-4.6")).toBeTruthy();
    expect(screen.getByText("31")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "settings.vendor.dshOpenUi" }));
    expect(openUrlMock).toHaveBeenCalledWith("http://127.0.0.1:3080");
    fireEvent.click(screen.getByRole("button", { name: "settings.vendor.dshStopService" }));
    await waitFor(() => {
      expect(cancelDshHostMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByLabelText("settings.vendor.dshHost")).toBeNull();
  });

  it("starts a down host without calling it missing", async () => {
    runDshDoctorMock.mockResolvedValue({
      ...connectedDoctor(),
      appServerOk: false,
      hostDescribe: {
        ok: false,
        origin: "http://127.0.0.1:3080",
        error: "connection refused",
      },
    });
    renderPanel({ dshAutoStart: false });
    await waitFor(() => {
      expect(screen.getByText("settings.vendor.dshHostDown")).toBeTruthy();
    });
    expect(screen.queryByText("settings.vendor.dshNotInstalled")).toBeNull();
    expect(screen.getByText("settings.vendor.dshDescribeFailed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "settings.vendor.dshStartNow" }));
    await waitFor(() => {
      expect(ensureDshHostMock).toHaveBeenCalledTimes(1);
    });
  });

  it("lets the user cancel an in-flight start", async () => {
    let resolveStart: (value: DshHostEnsureResult) => void = () => {
      throw new Error("ensureDshHost was not started");
    };
    ensureDshHostMock.mockImplementation(
      () =>
        new Promise<DshHostEnsureResult>((resolve) => {
          resolveStart = resolve;
        }),
    );
    cancelDshHostMock.mockResolvedValue(undefined);
    runDshDoctorMock.mockResolvedValue({
      ...connectedDoctor(),
      appServerOk: false,
      hostDescribe: {
        ok: false,
        origin: "http://127.0.0.1:3080",
        error: "connection refused",
      },
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.vendor.dshStartNow" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.vendor.dshStartNow" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "settings.vendor.dshCancelStart" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.vendor.dshCancelStart" }));
    await waitFor(() => {
      expect(cancelDshHostMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolveStart({
        origin: "http://127.0.0.1:3080",
        host: "127.0.0.1",
        port: 3080,
        ownership: "spawned",
        describe: null,
      });
    });
  });

  it("saves host and port from the collapsed connection settings", async () => {
    const { onUpdateAppSettings } = renderPanel();
    await waitFor(() => {
      expect(screen.getByText("settings.vendor.dshHostConnected")).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /settings.vendor.dshConnectionSettings/ }),
    );
    const hostInput = screen.getByLabelText("settings.vendor.dshHost");
    fireEvent.change(hostInput, { target: { value: "10.0.0.8" } });
    fireEvent.blur(hostInput);
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ dshHost: "10.0.0.8" }),
    );
  });

  it("treats a missing CLI as install-only and does not offer start", async () => {
    runDshDoctorMock.mockResolvedValue({
      ok: false,
      codexBin: "dsh",
      version: null,
      appServerOk: false,
      details: "dsh CLI is not installed",
      path: null,
      nodeOk: true,
      nodeVersion: "v22.22.3",
      nodeDetails: null,
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("settings.vendor.dshNotInstalled")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "settings.vendor.dshStartNow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "settings.vendor.dshRecheck" })).toBeNull();
    await waitFor(() => {
      expect(screen.getByLabelText("settings.vendor.dshHost")).toBeTruthy();
    });
  });

  it("persists auto-start without spawning the host", async () => {
    const { onUpdateAppSettings } = renderPanel({ dshAutoStart: false });
    await waitFor(() => {
      expect(screen.getByLabelText("settings.vendor.dshAutoStart")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("settings.vendor.dshAutoStart"));
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ dshAutoStart: true }),
    );
    expect(ensureDshHostMock).not.toHaveBeenCalled();
  });
});
