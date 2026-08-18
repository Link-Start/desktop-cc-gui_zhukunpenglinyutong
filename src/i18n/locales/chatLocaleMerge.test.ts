import { describe, expect, it } from "vitest";
import en from "./en";
import zh from "./zh";

describe("chat locale merge", () => {
  it("keeps chat copy from all locale parts", () => {
    expect(zh.composer.queueStatusFuseReady).toBe("可并入本轮回复");
    expect(zh.chat.fuseFromQueue).toBe("融合");
    expect(en.composer.queueStatusFuseReady).toBe("Can fuse into current turn");
    expect(en.chat.fuseFromQueue).toBe("Fuse");
  });

  it("keeps load-earlier chip copy in zh and en", () => {
    expect(zh.messages.loadEarlierMessages).toBe("加载更早的消息");
    expect(en.messages.loadEarlierMessages).toBe("Load earlier messages");
    expect(zh.messages.loadAllEarlierMessages).toBe("All");
    expect(en.messages.loadAllEarlierMessages).toBe("All");
    expect(zh.messages.loadEarlierMessages).not.toBe(
      "messages.loadEarlierMessages",
    );
  });
});
