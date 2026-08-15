import type { SpecChangePreflightResult } from "./types";
import { asPathSet, hasPrefix } from "./runtimeShared";
import { readOptionalWorkspaceFile } from "./runtimeIo";
import {
  parseDeltaRequirementOperations,
  parseDeltaRequirementTitlesByOperation,
  parseRequirementTitles,
  REQUIRE_EXISTING_TARGET_OPERATIONS,
  toTargetSpecPath,
  normalizeRequirementTitle,
} from "./runtimeParse";

export async function collectArchivePreflightBlockers(input: {
  workspaceId: string;
  base: string;
  specPaths: string[];
  files: Set<string>;
  customSpecRoot?: string | null;
}) {
  const blockers = new Set<string>();

  await Promise.all(
    input.specPaths.map(async (deltaSpecPath) => {
      const targetSpecPath = toTargetSpecPath(input.base, deltaSpecPath);
      if (!targetSpecPath) {
        return;
      }

      const deltaResponse = await readOptionalWorkspaceFile(
        input.workspaceId,
        deltaSpecPath,
        input.customSpecRoot,
      );
      if (!deltaResponse.exists) {
        return;
      }

      const operations = [...parseDeltaRequirementOperations(deltaResponse.content)].filter((operation) =>
        REQUIRE_EXISTING_TARGET_OPERATIONS.has(operation),
      );
      if (operations.length === 0) {
        return;
      }
      const requirementTitlesByOperation = parseDeltaRequirementTitlesByOperation(deltaResponse.content);

      if (!input.files.has(targetSpecPath)) {
        blockers.add(
          `Archive preflight failed: delta ${operations.join("/")} requires existing ${targetSpecPath}`,
        );
        return;
      }

      const targetResponse = await readOptionalWorkspaceFile(
        input.workspaceId,
        targetSpecPath,
        input.customSpecRoot,
      );
      if (!targetResponse.exists) {
        blockers.add(
          `Archive preflight failed: delta ${operations.join("/")} requires existing ${targetSpecPath}`,
        );
        return;
      }

      const targetTitles = parseRequirementTitles(targetResponse.content);
      for (const operation of operations) {
        const titles = requirementTitlesByOperation.get(operation) ?? [];
        for (const title of titles) {
          const normalizedTitle = normalizeRequirementTitle(title);
          if (!targetTitles.has(normalizedTitle)) {
            blockers.add(
              `Archive preflight failed: delta ${operation} requirement missing in ${targetSpecPath} -> ${normalizedTitle}`,
            );
          }
        }
      }
    }),
  );

  return [...blockers].sort((a, b) => a.localeCompare(b));
}

function derivePreflightHints(blockers: string[]) {
  const hints = new Set<string>();
  for (const blocker of blockers) {
    if (/delta\s+[A-Z/]+\s+requires existing/i.test(blocker)) {
      hints.add("Create the missing target spec under openspec/specs or switch delta operation to ADDED.");
      continue;
    }
    if (/delta\s+[A-Z]+\s+requirement missing in/i.test(blocker)) {
      hints.add("Align MODIFIED/REMOVED/RENAMED requirement title with target spec header exactly.");
      hints.add("If target requirement does not exist, change operation to ADDED.");
    }
  }
  return [...hints];
}

function deriveAffectedSpecs(blockers: string[]) {
  const specs = new Set<string>();
  for (const blocker of blockers) {
    const matched = blocker.match(/(openspec[\\/]+specs[\\/]+.+?\.md)\b/i);
    if (matched?.[1]) {
      specs.add(matched[1].replace(/\\/g, "/"));
    }
  }
  return [...specs].sort((a, b) => a.localeCompare(b));
}

export async function evaluateOpenSpecChangePreflight(input: {
  workspaceId: string;
  changeId: string;
  files: string[];
  customSpecRoot?: string | null;
}): Promise<SpecChangePreflightResult> {
  const base = `openspec/changes/${input.changeId}`;
  const fileSet = asPathSet(input.files);
  const specPaths = input.files
    .filter((entry) => hasPrefix(entry, `${base}/specs`) && entry.endsWith(".md"))
    .sort();

  const blockers = await collectArchivePreflightBlockers({
    workspaceId: input.workspaceId,
    base,
    specPaths,
    files: fileSet,
    customSpecRoot: input.customSpecRoot,
  });
  return {
    blockers,
    hints: derivePreflightHints(blockers),
    affectedSpecs: deriveAffectedSpecs(blockers),
  };
}
