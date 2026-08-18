import { describe, expect, it } from "vitest";
import {
  resolveDshModelForSend,
  resolveDshSendFallbackCatalogId,
  resolveNativeSessionIdForSend,
} from "./threadMessagingHelpers";

describe("resolveNativeSessionIdForSend", () => {
  it("slices finalized native ids and looks up pending maps", () => {
    expect(
      resolveNativeSessionIdForSend({
        engine: "dsh",
        threadId: "dsh:session-1",
        pendingSessionByEngine: {},
      }),
    ).toBe("session-1");
    expect(
      resolveNativeSessionIdForSend({
        engine: "dsh",
        threadId: "dsh-pending-abc",
        pendingSessionByEngine: { dsh: "session-2" },
      }),
    ).toBe("session-2");
  });

  it("keeps Claude pending threads unbound until native confirmation", () => {
    expect(
      resolveNativeSessionIdForSend({
        engine: "claude",
        threadId: "claude-pending-abc",
        pendingSessionByEngine: { claude: "sess-x" },
      }),
    ).toBeNull();
  });
});

describe("resolveDshModelForSend", () => {
  it("prefers the provider/model catalog id over a bare runtime name", () => {
    expect(
      resolveDshModelForSend({
        catalogId: "grok/Grok 4.5",
        runtimeModel: "Grok 4.5",
      }),
    ).toBe("grok/Grok 4.5");
  });

  it("returns null when neither catalog nor runtime is present", () => {
    expect(resolveDshModelForSend({})).toBeNull();
  });

  it("rejects mossx managed ccgui catalog ids instead of forwarding them", () => {
    expect(
      resolveDshModelForSend({
        catalogId: "ccgui/grok-4.5",
        runtimeModel: "grok-4.5",
      }),
    ).toBeNull();
    expect(
      resolveDshModelForSend({
        catalogId: "CCGUI/kimi-k2",
        fallbackCatalogId: "ccgui/grok-4.5",
      }),
    ).toBeNull();
  });

  it("falls back to a trusted dsh pref when the resolver leaked ccgui", () => {
    expect(
      resolveDshModelForSend({
        catalogId: "ccgui/grok-4.5",
        runtimeModel: "grok-4.5",
        fallbackCatalogId: "ggggg/grok-4.6",
      }),
    ).toBe("ggggg/grok-4.6");
  });

  it("keeps custom DSH providers and nested model ids", () => {
    expect(
      resolveDshModelForSend({
        catalogId: "deepseek-official/deepseek-v4-flash",
      }),
    ).toBe("deepseek-official/deepseek-v4-flash");
    expect(
      resolveDshModelForSend({
        catalogId: "vision-http/ovh/Qwen2.5-VL-72B-Instruct",
      }),
    ).toBe("vision-http/ovh/Qwen2.5-VL-72B-Instruct");
  });

  it("does not send a bare last-segment runtime as a DSH catalog id", () => {
    expect(
      resolveDshModelForSend({
        catalogId: "grok-4.6",
        runtimeModel: "grok-4.6",
      }),
    ).toBeNull();
  });
});

describe("resolveDshSendFallbackCatalogId", () => {
  it("uses the global dsh pref only for a pending first send", () => {
    expect(
      resolveDshSendFallbackCatalogId(
        "dsh-pending-abc",
        "ggggg/grok-4.6",
      ),
    ).toBe("ggggg/grok-4.6");
  });

  it("omits the global dsh pref on an existing session thread", () => {
    expect(
      resolveDshSendFallbackCatalogId("dsh:session-1", "ggggg/grok-4.6"),
    ).toBeNull();
  });
});
