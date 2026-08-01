/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ttGet, ttRequest } from "./tt-transport";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

function enterTauriRuntime() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

function leaveTauriRuntime() {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

describe("tt-transport", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    leaveTauriRuntime();
    vi.unstubAllGlobals();
  });

  it("routes ttGet through the tt_proxy command with the path and accept header", async () => {
    enterTauriRuntime();
    invokeMock.mockResolvedValue({ totalTokens: 42 });

    const result = await ttGet("/functions/tokentracker-usage-summary?period=month");

    expect(invokeMock).toHaveBeenCalledWith("tt_proxy", {
      method: "GET",
      path: "/functions/tokentracker-usage-summary?period=month",
      headers: { Accept: "application/json" },
      body: null,
    });
    expect(result).toEqual({ totalTokens: 42 });
  });

  it("serializes request bodies to a JSON string before invoking", async () => {
    enterTauriRuntime();
    invokeMock.mockResolvedValue(null);

    await ttRequest(
      "POST",
      "/functions/tokentracker-local-sync",
      { "Content-Type": "application/json" },
      { full: true },
    );

    expect(invokeMock).toHaveBeenCalledWith("tt_proxy", {
      method: "POST",
      path: "/functions/tokentracker-local-sync",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full: true }),
    });
  });

  it("rethrows non-2xx proxy failures as an Error with a numeric status", async () => {
    enterTauriRuntime();
    invokeMock.mockRejectedValue(
      "tokentracker server returned HTTP 500: internal boom",
    );

    const failure = await ttGet("/functions/tokentracker-usage-daily").catch(
      (error) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure.status).toBe(500);
    expect(failure.message).toBe("Request failed with HTTP 500");
  });

  it("passes through invoke failures that carry no HTTP status", async () => {
    enterTauriRuntime();
    invokeMock.mockRejectedValue(new Error("socket closed"));

    await expect(ttGet("/functions/tokentracker-user-status")).rejects.toThrow(
      "socket closed",
    );
  });

  it("falls back to the /tt-dev fetch proxy outside the Tauri runtime", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [1, 2] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await ttGet("/functions/tokentracker-usage-daily");

    expect(fetchMock).toHaveBeenCalledWith(
      "/tt-dev/functions/tokentracker-usage-daily",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
    expect(result).toEqual({ rows: [1, 2] });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("surfaces non-ok dev-fallback responses with a numeric status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
    );

    const failure = await ttGet("/functions/tokentracker-usage-hourly").catch(
      (error) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure.status).toBe(503);
  });
});
