/**
 * DSH durable user-role injections that must not render as chat bubbles.
 *
 * DSH persists workspace instructions, runtime snapshots, and skill catalogs as
 * `user/message` events. Real human prompts carry `source.kind === "user"`;
 * everything else is producer-supplied context (see DSH MessageSourceMap).
 */

const DSH_RUNTIME_CONTEXT_TAGS = [
  "system-reminder",
  "available_skills",
  "agent_skills",
] as const;

const DSH_RUNTIME_CONTEXT_PROSE_PREFIX = /^current runtime context(?:\.|:)/i;

export function readDshMessageSourceKind(message: Record<string, unknown>): string | null {
  const direct = message.sourceKind ?? message.source_kind;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim().toLowerCase();
  }
  const source = message.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const kind = (source as Record<string, unknown>).kind;
    if (typeof kind === "string" && kind.trim()) {
      return kind.trim().toLowerCase();
    }
  }
  return null;
}

function removeXmlBlock(text: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const lower = text.toLowerCase();
  const start = lower.indexOf(open.toLowerCase());
  if (start < 0) {
    return text;
  }
  const afterOpen = text.slice(start + open.length);
  const afterOpenLower = afterOpen.toLowerCase();
  const tagEnd = afterOpenLower.indexOf(">");
  if (tagEnd < 0) {
    return text.slice(0, start);
  }
  const innerStart = start + open.length + tagEnd + 1;
  const closeAt = text.slice(innerStart).toLowerCase().indexOf(close.toLowerCase());
  if (closeAt < 0) {
    return text.slice(0, start);
  }
  return `${text.slice(0, start)}${text.slice(innerStart + closeAt + close.length)}`;
}

function stripDshRuntimeContextEnvelopes(text: string): string {
  let rest = text;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const before = rest;
    for (const tag of DSH_RUNTIME_CONTEXT_TAGS) {
      rest = removeXmlBlock(rest, tag);
    }
    if (rest === before) {
      break;
    }
  }
  return rest;
}

export function isDshRuntimeContextText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (DSH_RUNTIME_CONTEXT_PROSE_PREFIX.test(trimmed)) {
    return true;
  }
  return stripDshRuntimeContextEnvelopes(trimmed).trim().length === 0;
}

export function isDshInjectedContextMessage(params: {
  text: string;
  sourceKind?: string | null;
}): boolean {
  const sourceKind = params.sourceKind?.trim().toLowerCase() ?? "";
  if (sourceKind === "user") {
    return false;
  }
  if (sourceKind) {
    return true;
  }
  return isDshRuntimeContextText(params.text);
}
