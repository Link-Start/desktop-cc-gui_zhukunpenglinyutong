import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLocalFileUrl,
  formatOpenHtmlInBrowserError,
  isHtmlFilePath,
  openHtmlInBrowser,
  resolveOpenHtmlInBrowserErrorKind,
} from "./openHtmlInBrowser";

const requestBrowserDockOpenUrlMock = vi.fn();

vi.mock("../../browser-agent/state/dockEvents", () => ({
  requestBrowserDockOpenUrl: (...args: unknown[]) =>
    requestBrowserDockOpenUrlMock(...args),
}));

describe("isHtmlFilePath", () => {
  it("accepts .html and .htm regardless of case", () => {
    expect(isHtmlFilePath("index.html")).toBe(true);
    expect(isHtmlFilePath("docs/Page.HTM")).toBe(true);
    expect(isHtmlFilePath("C:\\site\\App.HTML")).toBe(true);
  });

  it("rejects non-html extensions and empty paths", () => {
    expect(isHtmlFilePath("readme.md")).toBe(false);
    expect(isHtmlFilePath("index.html.bak")).toBe(false);
    expect(isHtmlFilePath("")).toBe(false);
    expect(isHtmlFilePath("   ")).toBe(false);
  });
});

describe("buildLocalFileUrl", () => {
  it("builds POSIX file URLs", () => {
    expect(buildLocalFileUrl("/Users/me/site/index.html")).toBe(
      "file:///Users/me/site/index.html",
    );
  });

  it("builds Windows drive-letter file URLs", () => {
    expect(buildLocalFileUrl("C:\\Users\\me\\site\\index.html")).toBe(
      "file:///C:/Users/me/site/index.html",
    );
  });

  it("encodes spaces, Chinese characters, and URL-significant chars", () => {
    expect(buildLocalFileUrl("/Users/me/my site/测试.html")).toBe(
      "file:///Users/me/my%20site/%E6%B5%8B%E8%AF%95.html",
    );
    expect(buildLocalFileUrl("C:/docs/a#b?.html")).toBe(
      "file:///C:/docs/a%23b%3F.html",
    );
  });
});

describe("openHtmlInBrowser", () => {
  beforeEach(() => {
    requestBrowserDockOpenUrlMock.mockReset();
  });

  it("opens the encoded file:// URL via the embedded Browser Dock", async () => {
    await openHtmlInBrowser("/repo/docs/demo.html", {
      workspaceId: "ws-1",
      ownerSurface: "file-view",
    });
    expect(requestBrowserDockOpenUrlMock).toHaveBeenCalledWith(
      "file:///repo/docs/demo.html",
    );
  });

  it("requires workspaceId", async () => {
    await expect(
      openHtmlInBrowser("/repo/a.html", { workspaceId: "  " }),
    ).rejects.toThrow(/workspaceId is required/);
    expect(requestBrowserDockOpenUrlMock).not.toHaveBeenCalled();
  });
});

describe("resolveOpenHtmlInBrowserErrorKind / formatOpenHtmlInBrowserError", () => {
  const t = (key: string) => key;

  it("maps window-already-exists to window-busy", () => {
    const error = new Error(
      "Failed to open Browser Agent window: a webview with label `browser-agent-window` already exists",
    );
    expect(resolveOpenHtmlInBrowserErrorKind(error)).toBe("window-busy");
    expect(formatOpenHtmlInBrowserError(error, t)).toBe(
      "files.openInBrowserWindowBusy",
    );
  });

  it("maps missing workspaceId to no-workspace", () => {
    expect(
      resolveOpenHtmlInBrowserErrorKind(
        new Error("workspaceId is required to open HTML in the built-in browser"),
      ),
    ).toBe("no-workspace");
  });

  it("maps blocked policy errors to blocked", () => {
    expect(
      resolveOpenHtmlInBrowserErrorKind(new Error("URL blocked_file_type")),
    ).toBe("blocked");
  });

  it("falls back to failed without leaking raw text", () => {
    const error = new Error("browser missing internal detail xyz");
    expect(resolveOpenHtmlInBrowserErrorKind(error)).toBe("failed");
    expect(formatOpenHtmlInBrowserError(error, t)).toBe(
      "files.openInBrowserFailed",
    );
    expect(formatOpenHtmlInBrowserError(error, t)).not.toContain("xyz");
  });
});
