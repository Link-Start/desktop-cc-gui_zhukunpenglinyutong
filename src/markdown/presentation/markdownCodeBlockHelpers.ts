import { resolvePreviewLanguageFromPath } from "../../utils/fileLanguageRegistry";

export type MarkdownPreNode = {
  tagName?: string;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
  children?: Array<{
    tagName?: string;
    properties?: { className?: string[] | string };
    children?: Array<{ value?: string }>;
  }>;
};

export type CodeFenceMeta = {
  languageTag: string | null;
  label: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
};

const MARKDOWN_LANGUAGE_SET = new Set(["markdown", "md", "mdx"]);
const CITATION_FENCE_PATTERN = /^(\d+):(\d+):(.+)$/;
const FILE_EXTENSION_PATTERN = /\.[a-zA-Z][a-zA-Z0-9]{0,8}$/;

export function extractLanguageTag(className?: string) {
  if (!className) {
    return null;
  }
  const match = className.match(/language-([\w-]+)/i);
  if (!match) {
    return null;
  }
  return match[1] ?? null;
}

function extractRawFenceInfo(className?: string): string | null {
  if (!className) {
    return null;
  }
  const match = className.match(/language-(\S+)/i);
  const raw = match?.[1]?.trim();
  return raw || null;
}

function looksLikeFilePath(value: string): boolean {
  return /[\\/]/.test(value) || FILE_EXTENSION_PATTERN.test(value);
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || filePath;
}

function formatCitationLabel(
  filePath: string,
  startLine: number | null,
  endLine: number | null,
): string {
  const fileName = fileNameFromPath(filePath);
  if (startLine == null) {
    return fileName;
  }
  if (endLine == null || endLine === startLine) {
    return `${fileName}:${startLine}`;
  }
  return `${fileName}:${startLine}-${endLine}`;
}

export function extractCodeFenceMeta(className?: string): CodeFenceMeta {
  const raw = extractRawFenceInfo(className);
  if (!raw) {
    return {
      languageTag: null,
      label: "Code",
      filePath: null,
      startLine: null,
      endLine: null,
    };
  }

  const citation = raw.match(CITATION_FENCE_PATTERN);
  if (citation) {
    const startLine = Number(citation[1]);
    const endLine = Number(citation[2]);
    const filePath = (citation[3] ?? "").trim();
    if (filePath) {
      return {
        languageTag: resolvePreviewLanguageFromPath(filePath),
        label: formatCitationLabel(filePath, startLine, endLine),
        filePath,
        startLine,
        endLine,
      };
    }
  }

  if (looksLikeFilePath(raw)) {
    return {
      languageTag: resolvePreviewLanguageFromPath(raw),
      label: formatCitationLabel(raw, null, null),
      filePath: raw,
      startLine: null,
      endLine: null,
    };
  }

  const languageTag = extractLanguageTag(`language-${raw}`) ?? raw;
  return {
    languageTag,
    label: languageTag,
    filePath: null,
    startLine: null,
    endLine: null,
  };
}

function isLatexLanguage(languageTag: string | null) {
  const normalized = languageTag?.toLowerCase();
  return normalized === "latex" || normalized === "tex";
}

function isMarkdownLanguage(languageTag: string | null) {
  if (!languageTag) {
    return false;
  }
  return MARKDOWN_LANGUAGE_SET.has(languageTag.trim().toLowerCase());
}

export function extractMarkdownContent(
  languageTag: string | null,
  value: string,
): string | null {
  if (isMarkdownLanguage(languageTag) && value.trim()) {
    return value;
  }
  const fencedMatch = value.match(/^```(?:markdown|md|mdx)\s*\n([\s\S]*?)(?:\n```\s*)?$/i);
  if (!fencedMatch) {
    return null;
  }
  const inner = (fencedMatch[1] ?? "").trim();
  return inner || null;
}

export function shouldRenderMarkdownFenceAsCard(
  node: MarkdownPreNode | undefined,
  sourceMarkdown: string,
) {
  const startOffset = node?.position?.start?.offset;
  if (typeof startOffset !== "number" || startOffset < 0) {
    return false;
  }
  const lineStart = sourceMarkdown.lastIndexOf("\n", Math.max(0, startOffset - 1)) + 1;
  const leadingIndent = sourceMarkdown.slice(lineStart, startOffset);
  return leadingIndent.length === 0;
}

export function extractCodeFromPre(node?: MarkdownPreNode) {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  const className = codeNode?.properties?.className;
  const normalizedClassName = Array.isArray(className)
    ? className.join(" ")
    : className;
  const value =
    codeNode?.children?.map((child) => child.value ?? "").join("") ?? "";
  return {
    className: normalizedClassName,
    value: value.replace(/\n$/, ""),
  };
}

function normalizeUrlLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const withoutBullet = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "");
  if (!/^https?:\/\/\S+$/i.test(withoutBullet)) {
    return null;
  }
  return withoutBullet;
}

export function extractUrlLines(value: string) {
  const lines = value.split(/\r?\n/);
  const urls = lines
    .map((line) => normalizeUrlLine(line))
    .filter((line): line is string => Boolean(line));
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return null;
  }
  if (urls.length !== nonEmptyLines.length) {
    return null;
  }
  return urls;
}

export function extractLatexContent(
  languageTag: string | null,
  value: string,
): string | null {
  if (isLatexLanguage(languageTag) && value.trim()) {
    return value;
  }
  const fencedMatch = value.match(/^```(?:latex|tex)\s*\n([\s\S]*?)(?:\n```\s*)?$/i);
  if (!fencedMatch) {
    return null;
  }
  const inner = (fencedMatch[1] ?? "").trim();
  return inner || null;
}

function isMermaidLanguageTag(languageTag: string | null) {
  if (!languageTag) {
    return false;
  }
  const normalized = languageTag.trim().toLowerCase();
  // File preview already treats `flowchart` as mermaid; keep message side aligned.
  return normalized === "mermaid" || normalized === "flowchart";
}

export function extractMermaidContent(
  languageTag: string | null,
  value: string,
): string | null {
  // Case 1: react-markdown correctly parsed the language tag
  if (isMermaidLanguageTag(languageTag) && value.trim()) {
    return value;
  }
  // Case 2: fenced marker leaked into the content (e.g. ```mermaid\n...\n```)
  const fencedMatch = value.match(
    /^```(?:mermaid|flowchart)\s*\n([\s\S]*?)(?:\n```\s*)?$/i,
  );
  if (fencedMatch) {
    const inner = (fencedMatch[1] ?? "").trim();
    if (inner) return inner;
  }
  return null;
}
