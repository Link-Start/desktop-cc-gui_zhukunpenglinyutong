import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T4：生产 consumer 不得再调用 Legacy 命名的 adapt/flatten API；
 * 应使用 selectAppShellDomainBag / bind / merge。
 *
 * S4 PR-F：legacy flatten 全量退休——门面文件、defaults 冗余 bag 与
 * legacy 命名 API 均已删除，本门禁从「隔离 legacy」推进为「禁止复活」。
 */

const currentDir = dirname(fileURLToPath(import.meta.url));

const PRODUCTION_CONSUMERS = [
  "../render/renderAppShell.tsx",
  "../sections/core/useAppShellSections.ts",
  "../sections/layoutNodes/useAppShellLayoutNodesSection.tsx",
] as const;

const RETIRED_LEGACY_IDENTIFIERS = [
  "flattenAppShellDomainContexts",
  "flattenSelectedAppShellDomainContexts",
  "adaptAppShellLegacyFlatContext",
  "AppShellLegacyFlatContext",
  "APP_SHELL_LEGACY_CONTEXT_DEFAULTS",
] as const;

describe("appShellLegacyFlattenRetirement (T4 + S4 PR-F)", () => {
  it("lists production consumers on selected domain bag API (T4.1/T4.2)", () => {
    for (const rel of PRODUCTION_CONSUMERS) {
      const source = readFileSync(join(currentDir, rel), "utf8");
      expect(source).toContain("selectAppShellDomainBag");
      expect(source).not.toContain("adaptAppShellLegacyFlatContext");
      expect(source).not.toContain(
        "flattenSelectedAppShellDomainContextsMemoized(",
      );
      expect(source).not.toContain("flattenAppShellDomainContexts(");
    }
  });

  it("keeps legacy facade and defaults bag deleted (S4 PR-F: T4.5 推进为禁止复活)", () => {
    // legacy 门面与 defaults 冗余 bag 已删除，不得重新引入
    expect(existsSync(join(currentDir, "../legacy/legacyFlatten.ts"))).toBe(
      false,
    );
    expect(
      existsSync(join(currentDir, "../legacy/legacyContextDefaults.ts")),
    ).toBe(false);
    expect(
      existsSync(join(currentDir, "../../app-shell-parts/legacyContextDefaults.ts")),
    ).toBe(false);

    // 域定义模块不得再出现任何 legacy flatten/adapt 命名（定义或调用）
    const domainModule = readFileSync(
      join(currentDir, "../domains/appShellDomainContexts.ts"),
      "utf8",
    );
    for (const identifier of RETIRED_LEGACY_IDENTIFIERS) {
      expect(domainModule).not.toContain(identifier);
    }
    // memoized selected-flatten 引擎只许留在 selectAppShellDomainBag 模块内部
    expect(domainModule).not.toContain(
      "flattenSelectedAppShellDomainContextsMemoized",
    );
    const bagModule = readFileSync(
      join(currentDir, "../domains/selectAppShellDomainBag.ts"),
      "utf8",
    );
    expect(bagModule).toContain("DomainFlattenIdentityCache");
  });

  it("locks consumer domain selection sets as the required flatten sets (T4.3)", () => {
    const source = readFileSync(
      join(currentDir, "../domains/appShellDomainContexts.ts"),
      "utf8",
    );
    expect(source).toContain("APP_SHELL_CONSUMER_DOMAIN_SELECTION");
    // sections/render 不得包含 runtimeThread（热路径隔离）
    const sectionsBlock = source.slice(
      source.indexOf("sections: ["),
      source.indexOf("render: ["),
    );
    expect(sectionsBlock).not.toContain("runtimeThreadContext");
  });
});
