import { describe, expect, it } from "vitest";
import en from "./en/noteCards";
import es from "./es/noteCards";
import fr from "./fr/noteCards";
import hi from "./hi/noteCards";
import ja from "./ja/noteCards";
import ko from "./ko/noteCards";
import ptBR from "./pt-BR/noteCards";
import ru from "./ru/noteCards";
import zh from "./zh/noteCards";
import zhTW from "./zh-TW/noteCards";

const locales = { es, fr, hi, ja, ko, "pt-BR": ptBR, ru, zh, "zh-TW": zhTW };

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("note card locale parity", () => {
  it.each(Object.entries(locales))(
    "%s mirrors the English keys and interpolation placeholders",
    (_language, locale) => {
      expect(Object.keys(locale.noteCards).sort()).toEqual(
        Object.keys(en.noteCards).sort(),
      );
      Object.entries(en.noteCards).forEach(([key, value]) => {
        const translated = locale.noteCards[key as keyof typeof locale.noteCards];
        expect(placeholders(translated)).toEqual(placeholders(value));
      });
    },
  );
});
