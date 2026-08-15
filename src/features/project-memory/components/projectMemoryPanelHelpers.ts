export function parseTagTerms(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
}

export type MemoryDetailSection = {
  label: string;
  content: string;
};

export const DEFAULT_VISIBLE_QUICK_TAG_COUNT = 8;

export const DETAIL_SECTION_MARKER_REGEX =
  /(用户输入|AI 回复|AI 思考摘要|助手输出摘要|助手输出|User input|Assistant response|Assistant thinking summary|Assistant summary|Assistant output)[:：]/gi;

export function normalizeDetailSectionLabel(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "user input") {
    return "User input";
  }
  if (normalized === "assistant summary") {
    return "Assistant summary";
  }
  if (normalized === "assistant output") {
    return "Assistant output";
  }
  return raw.trim();
}

export function parseMemoryDetailSections(detail: string): MemoryDetailSection[] {
  const text = detail.trim();
  if (!text) {
    return [];
  }
  const matches = Array.from(
    text.matchAll(
      new RegExp(DETAIL_SECTION_MARKER_REGEX.source, DETAIL_SECTION_MARKER_REGEX.flags),
    ),
  );
  if (matches.length === 0) {
    return [];
  }
  const sections: MemoryDetailSection[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!current || current.index === undefined) {
      continue;
    }
    const rawLabel = current[1] ?? "";
    const start = current.index + current[0].length;
    const next = matches[i + 1];
    const end = next?.index ?? text.length;
    const content = text.slice(start, end).trim();
    if (!content) {
      continue;
    }
    sections.push({
      label: normalizeDetailSectionLabel(rawLabel),
      content,
    });
  }
  return sections;
}
