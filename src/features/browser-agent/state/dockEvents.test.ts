/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  dequeuePendingBrowserUrl,
  enqueuePendingBrowserUrl,
  PENDING_BROWSER_URL_KEY,
  PENDING_BROWSER_URLS_KEY,
  requestBrowserDockOpenUrl,
} from "./dockEvents";

describe("pending browser URL queue", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps every queued URL instead of overwriting the last one", () => {
    enqueuePendingBrowserUrl("file:///a.html");
    enqueuePendingBrowserUrl("file:///b.html");
    enqueuePendingBrowserUrl("file:///c.html");

    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBe(
      "file:///a.html",
    );
    expect(JSON.parse(window.sessionStorage.getItem(PENDING_BROWSER_URLS_KEY) ?? "[]")).toEqual([
      "file:///a.html",
      "file:///b.html",
      "file:///c.html",
    ]);
    expect(dequeuePendingBrowserUrl()).toBe("file:///a.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///b.html");
    expect(dequeuePendingBrowserUrl("file:///c.html")).toBe("file:///c.html");
    expect(dequeuePendingBrowserUrl()).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_BROWSER_URL_KEY)).toBeNull();
  });

  it("does not dequeue a URL that was already consumed", () => {
    enqueuePendingBrowserUrl("file:///a.html");
    expect(dequeuePendingBrowserUrl("file:///a.html")).toBe("file:///a.html");
    expect(dequeuePendingBrowserUrl("file:///a.html")).toBeNull();
  });

  it("enqueues on requestBrowserDockOpenUrl so late dock mount can drain", () => {
    requestBrowserDockOpenUrl("file:///one.html");
    requestBrowserDockOpenUrl("file:///two.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///one.html");
    expect(dequeuePendingBrowserUrl()).toBe("file:///two.html");
  });

  it("dispatches open-dock then open-url so AppShell can expand the center split", () => {
    const events: Array<{ type: string; url?: string }> = [];
    const record = (type: string) => (event: Event) => {
      events.push({
        type,
        url: (event as CustomEvent<{ url?: string }>).detail?.url,
      });
    };
    const recordOpenDock = record("browser-agent:open-dock");
    const recordOpenUrl = record("browser-agent:open-url");
    window.addEventListener("browser-agent:open-dock", recordOpenDock);
    window.addEventListener("browser-agent:open-url", recordOpenUrl);
    try {
      requestBrowserDockOpenUrl("file:///repo/docs/demo.html");
      expect(events).toEqual([
        { type: "browser-agent:open-dock", url: undefined },
        { type: "browser-agent:open-url", url: "file:///repo/docs/demo.html" },
      ]);
    } finally {
      window.removeEventListener("browser-agent:open-dock", recordOpenDock);
      window.removeEventListener("browser-agent:open-url", recordOpenUrl);
    }
  });
});
