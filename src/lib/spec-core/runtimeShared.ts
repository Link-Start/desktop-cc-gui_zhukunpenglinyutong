import { normalizeSpecRootInput } from "./pathUtils";

export const DEFAULT_SPEC_ROOT_RELATIVE = "openspec";

export function asPathSet(paths: string[]) {
  return new Set(paths.filter(Boolean));
}

export function hasPrefix(value: string, prefix: string) {
  return value === prefix || value.startsWith(`${prefix}/`);
}

export function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function toNonEmpty(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "N/A";
}

export function normalizeCustomSpecRoot(path: string | null | undefined) {
  return normalizeSpecRootInput(path);
}
