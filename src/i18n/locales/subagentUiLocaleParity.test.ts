import { describe, expect, it } from "vitest";
import en from "./en/subagentUi";
import es from "./es/subagentUi";
import fr from "./fr/subagentUi";
import hi from "./hi/subagentUi";
import ja from "./ja/subagentUi";
import ko from "./ko/subagentUi";
import ptBR from "./pt-BR/subagentUi";
import ru from "./ru/subagentUi";
import zh from "./zh/subagentUi";
import zhTW from "./zh-TW/subagentUi";

const locales = { es, fr, hi, ja, ko, "pt-BR": ptBR, ru, zh, "zh-TW": zhTW };

type Bundle = { subagentUi: Record<string, unknown> };

function flattenKeys(node: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

function valueAt(node: Record<string, unknown>, path: string): string {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, segment) => (acc as Record<string, unknown>)[segment],
      node,
    ) as string;
}

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("subagentUi locale parity", () => {
  const enKeys = flattenKeys((en as Bundle).subagentUi).sort();

  it.each(Object.entries(locales))(
    "%s mirrors the English keys and interpolation placeholders",
    (_language, locale) => {
      const bundle = (locale as Bundle).subagentUi;
      expect(flattenKeys(bundle).sort()).toEqual(enKeys);
      enKeys.forEach((path) => {
        expect(placeholders(valueAt(bundle, path))).toEqual(
          placeholders(valueAt((en as Bundle).subagentUi, path)),
        );
      });
    },
  );
});
