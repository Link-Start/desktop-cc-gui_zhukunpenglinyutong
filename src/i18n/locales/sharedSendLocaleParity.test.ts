import { describe, expect, it } from "vitest";
import en from "./en/sharedSend";
import es from "./es/sharedSend";
import fr from "./fr/sharedSend";
import hi from "./hi/sharedSend";
import ja from "./ja/sharedSend";
import ko from "./ko/sharedSend";
import ptBR from "./pt-BR/sharedSend";
import ru from "./ru/sharedSend";
import zh from "./zh/sharedSend";
import zhTW from "./zh-TW/sharedSend";

const locales = { es, fr, hi, ja, ko, "pt-BR": ptBR, ru, zh, "zh-TW": zhTW };

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("shared send locale parity", () => {
  it.each(Object.entries(locales))(
    "%s mirrors the English keys and interpolation placeholders",
    (_language, locale) => {
      expect(Object.keys(locale.sharedSend).sort()).toEqual(
        Object.keys(en.sharedSend).sort(),
      );
      Object.entries(en.sharedSend).forEach(([key, value]) => {
        const translated = locale.sharedSend[key as keyof typeof locale.sharedSend];
        expect(placeholders(translated)).toEqual(placeholders(value));
      });
    },
  );

  it.each([
    ["zh", zh],
    ["zh-TW", zhTW],
  ])("%s does not expose protocol terms in user-facing copy", (_language, locale) => {
    const copy = Object.values(locale.sharedSend).join("\n");
    expect(copy).not.toMatch(
      /\b(?:Shared Session|omissions|Adapter|Probe|Binding|Attempt|Target|estimated tokens|portable-transcript|not-retrievable)\b/i,
    );
  });
});
