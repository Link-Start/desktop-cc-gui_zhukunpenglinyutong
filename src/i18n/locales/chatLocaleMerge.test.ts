import { describe, expect, it } from "vitest";
import en from "./en";
import zh from "./zh";
import es from "./es/messages";
import fr from "./fr/messages";
import hi from "./hi/messages";
import ja from "./ja/messages";
import ko from "./ko/messages";
import ptBR from "./pt-BR/messages";
import ru from "./ru/messages";
import zhTW from "./zh-TW/messages";

const nativeHistoryStageKeys = [
  "restoringHistoryPrepare",
  "restoringHistorySession",
  "restoringHistorySessionPage",
  "restoringHistoryParse",
  "restoringHistoryHydrate",
  "restoringHistoryFinalize",
  "restoringHistoryPhaseParse",
  "restoringHistoryPhaseHydrate",
] as const;

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

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

  it("keeps native history stage copy in all locales", () => {
    const locales = {
      zh,
      "zh-TW": zhTW,
      es,
      fr,
      hi,
      ja,
      ko,
      "pt-BR": ptBR,
      ru,
    };
    for (const [language, locale] of Object.entries(locales)) {
      for (const key of nativeHistoryStageKeys) {
        const translated = locale.messages[key];
        expect(translated, `${language}.messages.${key}`).toEqual(
          expect.any(String),
        );
        expect(placeholders(translated)).toEqual(
          placeholders(en.messages[key]),
        );
      }
    }
  });
});
