import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T2.5：禁止新增 full-flatten 调用点。
 * S4 PR-F：legacy full-flatten（flattenAppShellDomainContexts）已删除，
 * 本门禁零豁免——任何生产文件（含域定义模块）出现 full-flatten 即红。
 * selected-flatten 引擎只允许留在 selectAppShellDomainBag 模块内部。
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(currentDir, "..", "..");

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listTsFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("appShellFlattenGate (T2.5)", () => {
  it("bans production full-flatten outside domain contexts module", () => {
    const files = listTsFiles(srcRoot);
    const offenders: string[] = [];
    for (const file of files) {
      // S4 PR-F：零豁免——域定义模块内的 full-flatten 定义/调用同样禁止
      const source = readFileSync(file, "utf8");
      // 直接调用全量 flatten（非 selected / 非 memoized）
      if (
        /flattenAppShellDomainContexts\s*\(/.test(source) &&
        !/flattenSelectedAppShellDomainContexts/.test(
          source.match(/flattenAppShellDomainContexts\s*\(/)?.[0] ?? "",
        )
      ) {
        // 精确：行内出现 flattenAppShellDomainContexts( 即违规（定义亦不可）
        const lines = source.split("\n");
        lines.forEach((line, index) => {
          if (
            line.includes("flattenAppShellDomainContexts(") &&
            !line.includes("flattenSelectedAppShellDomainContexts")
          ) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("keeps hot consumers on selected-domain bag API only (T4.2)", () => {
    for (const rel of [
      "app-shell/render/renderAppShell.tsx",
      "app-shell/sections/core/useAppShellSections.ts",
      "app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx",
    ]) {
      const source = readFileSync(join(srcRoot, rel), "utf8");
      expect(source).toContain("selectAppShellDomainBag");
      expect(source).toContain("APP_SHELL_CONSUMER_DOMAIN_SELECTION");
      expect(source).not.toContain(
        "flattenSelectedAppShellDomainContextsMemoized(",
      );
      expect(source).not.toMatch(
        /flattenAppShellDomainContexts\s*\(\s*[^s]/,
      );
      expect(source).not.toContain("adaptAppShellLegacyFlatContext");
    }
  });
});
