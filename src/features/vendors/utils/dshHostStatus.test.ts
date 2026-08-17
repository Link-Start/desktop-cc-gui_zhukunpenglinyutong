import { describe, expect, it } from "vitest";
import type { CodexDoctorResult } from "../../../types";
import { buildDshOrigin, classifyDshHostError, mapDshDoctorToHostView } from "./dshHostStatus";

function doctor(partial: Partial<CodexDoctorResult>): CodexDoctorResult {
  return {
    ok: true,
    codexBin: "dsh",
    version: "0.1.0-rc.6",
    appServerOk: false,
    details: null,
    path: null,
    nodeOk: true,
    nodeVersion: "v22.22.3",
    nodeDetails: null,
    ...partial,
  };
}

describe("mapDshDoctorToHostView", () => {
  it("stays checking until a doctor payload arrives", () => {
    expect(
      mapDshDoctorToHostView({
        doctor: null,
        loading: true,
        host: "127.0.0.1",
        port: 3080,
      }).kind,
    ).toBe("checking");
  });

  it("treats a missing version as CLI not installed", () => {
    const view = mapDshDoctorToHostView({
      doctor: doctor({
        ok: false,
        version: null,
        details: "dsh CLI is not installed",
      }),
      loading: false,
      host: "127.0.0.1",
      port: 3080,
    });
    expect(view.kind).toBe("missing");
    expect(view.error).toContain("not installed");
  });

  it("does not report host-down as missing when the CLI version is known", () => {
    const view = mapDshDoctorToHostView({
      doctor: doctor({
        ok: true,
        appServerOk: false,
        hostDescribe: {
          ok: false,
          origin: "http://127.0.0.1:3080",
          error: "connection refused",
          details: "DSH host is not running",
        },
      }),
      loading: false,
      host: "127.0.0.1",
      port: 3080,
    });
    expect(view.kind).toBe("down");
    expect(view.origin).toBe("http://127.0.0.1:3080");
  });

  it("surfaces provider, model, and session count when describe succeeds", () => {
    const view = mapDshDoctorToHostView({
      doctor: doctor({
        appServerOk: true,
        hostDescribe: {
          ok: true,
          origin: "http://10.0.0.8:4090",
          describe: {
            provider: "grok",
            model: "grok-4.6",
            attachedSessions: 31,
          },
        },
      }),
      loading: false,
      host: "127.0.0.1",
      port: 3080,
    });
    expect(view).toMatchObject({
      kind: "connected",
      origin: "http://10.0.0.8:4090",
      provider: "grok",
      model: "grok-4.6",
      attachedSessions: 31,
    });
  });
});

describe("classifyDshHostError", () => {
  it("maps host.describe transport noise to a human-readable kind", () => {
    expect(
      classifyDshHostError(
        "dsh host.describe transport: error sending request for url (http://127.0.0.1:3080/api/host.describe)",
      ),
    ).toBe("transport");
  });
});

describe("buildDshOrigin", () => {
  it("falls back to the local default endpoint", () => {
    expect(buildDshOrigin("  ", 0)).toBe("http://127.0.0.1:3080");
  });
});
