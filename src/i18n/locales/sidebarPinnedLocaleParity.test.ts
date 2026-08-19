import { describe, expect, it } from "vitest";
import en from "./en/sidebar";
import es from "./es/sidebar";
import fr from "./fr/sidebar";
import hi from "./hi/sidebar";
import ja from "./ja/sidebar";
import ko from "./ko/sidebar";
import ptBR from "./pt-BR/sidebar";
import ru from "./ru/sidebar";
import zh from "./zh/sidebar";
import zhTW from "./zh-TW/sidebar";

const REQUIRED_KEYS = [
  "pinned",
  "pinnedCount",
  "collapsePinnedSection",
  "expandPinnedSection",
  "collapsePinnedDay",
  "expandPinnedDay",
] as const;

const PACKS: Array<[string, { sidebar: Record<string, string> }]> = [
  ["en", en],
  ["zh", zh],
  ["zh-TW", zhTW],
  ["ja", ja],
  ["ko", ko],
  ["es", es],
  ["fr", fr],
  ["hi", hi],
  ["pt-BR", ptBR],
  ["ru", ru],
];

describe("sidebar pinned fold locale parity", () => {
  it.each(PACKS)("%s has localized pinned fold copy", (locale, pack) => {
    for (const key of REQUIRED_KEYS) {
      const value = pack.sidebar[key];
      expect(value, `${locale}.sidebar.${key}`).toBeTruthy();
      expect(value, `${locale}.sidebar.${key}`).not.toBe(`sidebar.${key}`);
    }
    expect(pack.sidebar.pinnedCount).toContain("{{count}}");
    expect(pack.sidebar.collapsePinnedDay).toContain("{{date}}");
    expect(pack.sidebar.expandPinnedDay).toContain("{{date}}");
  });
});
