import { describe, expect, it } from "vitest";
import {
  resolveDshModelForSend,
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
});
