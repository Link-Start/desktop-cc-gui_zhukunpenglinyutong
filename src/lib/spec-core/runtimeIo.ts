import {
  listExternalSpecTree,
  readExternalSpecFile,
  readWorkspaceFile,
  runWorkspaceCommand,
} from "../../services/tauri";
import { asPathSet, normalizeCustomSpecRoot } from "./runtimeShared";

export async function readOptionalWorkspaceFile(
  workspaceId: string,
  path: string | null,
  customSpecRoot?: string | null,
) {
  if (!path) {
    return { content: "", truncated: false, exists: false };
  }
  try {
    const normalizedSpecRoot = normalizeCustomSpecRoot(customSpecRoot);
    if (normalizedSpecRoot) {
      const response = await readExternalSpecFile(workspaceId, normalizedSpecRoot, path);
      return {
        content: response.content,
        truncated: response.truncated,
        exists: response.exists,
      };
    }
    const response = await readWorkspaceFile(workspaceId, path);
    return {
      content: response.content,
      truncated: response.truncated,
      exists: true,
    };
  } catch {
    return { content: "", truncated: false, exists: false };
  }
}
export async function runWorkspaceBinary(
  workspaceId: string,
  command: string[],
  timeoutMs = 60_000,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const result = await runWorkspaceCommand(workspaceId, command, timeoutMs);
    return {
      ok: result.success,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runSpecKitProbe(workspaceId: string) {
  const specifyVersion = await runWorkspaceBinary(workspaceId, ["specify", "--version"]);
  if (specifyVersion.ok) {
    return specifyVersion;
  }
  const specKitVersion = await runWorkspaceBinary(workspaceId, ["spec-kit", "--version"]);
  if (specKitVersion.ok) {
    return specKitVersion;
  }
  const specifyHelp = await runWorkspaceBinary(workspaceId, ["specify", "--help"]);
  if (specifyHelp.ok) {
    return {
      ok: true,
      stdout: "specify",
      stderr: "",
    };
  }
  return specKitVersion.stderr ? specKitVersion : specifyVersion;
}

export async function readExternalSpecTreeSnapshot(input: {
  workspaceId: string;
  specRoot: string;
}): Promise<
  | {
      ok: true;
      files: Set<string>;
      directories: Set<string>;
    }
  | { ok: false; error: string }
> {
  try {
    const snapshot = await listExternalSpecTree(input.workspaceId, input.specRoot);
    return {
      ok: true,
      files: asPathSet(snapshot.files),
      directories: asPathSet(snapshot.directories),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseProbeValue(stdout: string) {
  const normalized = stdout.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { value: "-", detail: "not found" };
  }
  const [path, ...rest] = normalized.split(" ");
  return {
    value: rest.length > 0 ? rest.join(" ") : path,
    detail: path,
  };
}
