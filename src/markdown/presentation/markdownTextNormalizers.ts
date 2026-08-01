const MARKDOWN_ALERT_TONE_SET = new Set([
  "note",
  "tip",
  "important",
  "warning",
  "caution",
]);

const FRAGMENTED_PARAGRAPH_MIN_RUN = 5;
const FRAGMENTED_PARAGRAPH_MAX_LENGTH = 14;
const FRAGMENTED_PARAGRAPH_MIN_TOTAL_CHARS = 12;
const FRAGMENTED_PARAGRAPH_EDGE_MIN_LENGTH = 6;
const FRAGMENTED_LINE_MIN_RUN = 6;
const FRAGMENTED_LINE_MAX_LENGTH = 10;
const FRAGMENTED_LINE_MIN_TOTAL_CHARS = 12;
const PARAGRAPH_BREAK_SPLIT_REGEX = /\r?\n[^\S\r\n]*\r?\n+/;

const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const blockquoteContinuationCache = new Map<string, RegExp>();

function hasParagraphBreak(value: string) {
  return PARAGRAPH_BREAK_SPLIT_REGEX.test(value);
}

function getBlockquoteContinuationRegex(quotePrefix: string): RegExp {
  const cached = blockquoteContinuationCache.get(quotePrefix);
  if (cached) {
    return cached;
  }
  const escapedPrefix = quotePrefix.replace(REGEXP_SPECIAL_CHARS, "\\$&");
  const created = new RegExp(`^${escapedPrefix}(?:\\s+\\S|\\s*$)`);
  blockquoteContinuationCache.set(quotePrefix, created);
  return created;
}

function startsWithMarkdownBlockSyntax(value: string) {
  const trimmed = value.trimStart();
  return (
    /^[-*+]\s/.test(trimmed) ||
    /^\d+\.(?:\s|$|(?!\d)\S)/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^#{1,6}\s/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^\|/.test(trimmed)
  );
}

function endsWithSentencePunctuation(value: string) {
  return /[。！？!?;；:：]$/.test(value.trim());
}

function shouldMergeFragmentedParagraph(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= FRAGMENTED_PARAGRAPH_MAX_LENGTH &&
    !startsWithMarkdownBlockSyntax(trimmed)
  );
}

function joinFragmentedParagraphs(segments: string[]) {
  // 数组 push + 一次 join，避免 reduce 内字符串累积的 O(k²) 拷贝。
  const parts: string[] = [];
  let previousChar = "";
  for (const segment of segments) {
    if (!segment) {
      continue;
    }
    if (parts.length > 0) {
      const nextChar = segment[0] ?? "";
      if (/[A-Za-z0-9]/.test(previousChar) && /[A-Za-z0-9]/.test(nextChar)) {
        parts.push(" ");
      }
    }
    parts.push(segment);
    previousChar = segment[segment.length - 1] ?? "";
  }
  return parts.join("");
}

function extractBlockquoteParagraphText(paragraph: string) {
  const lines = paragraph.split(/\r?\n/);
  const fragments: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^\s*>\s?(.*)$/);
    if (!match) {
      return null;
    }
    const content = (match[1] ?? "").trim();
    if (!content || startsWithMarkdownBlockSyntax(content)) {
      return null;
    }
    fragments.push(content);
  }
  if (fragments.length === 0) {
    return null;
  }
  return joinFragmentedParagraphs(fragments);
}

function trimMergeWindowByPunctuation(
  entries: string[],
  start: number,
  end: number,
) {
  let mergeStart = start;
  let mergeEnd = end;
  while (mergeStart < mergeEnd) {
    const edge = entries[mergeStart] ?? "";
    if (
      edge.length >= FRAGMENTED_PARAGRAPH_EDGE_MIN_LENGTH &&
      endsWithSentencePunctuation(edge)
    ) {
      mergeStart += 1;
      continue;
    }
    break;
  }
  while (mergeEnd > mergeStart) {
    const edge = entries[mergeEnd - 1] ?? "";
    if (
      edge.length >= FRAGMENTED_PARAGRAPH_EDGE_MIN_LENGTH &&
      endsWithSentencePunctuation(edge)
    ) {
      mergeEnd -= 1;
      continue;
    }
    break;
  }
  return { mergeStart, mergeEnd };
}

function shouldMergeFragmentedLine(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= FRAGMENTED_LINE_MAX_LENGTH &&
    !startsWithMarkdownBlockSyntax(trimmed)
  );
}

function countLeadingSpaces(line: string) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function spaces(count: number) {
  return " ".repeat(Math.max(0, count));
}

export function normalizeListIndentation(value: string) {
  const lines = value.split(/\r?\n/);
  let inFence = false;
  let activeOrderedItem = false;
  let orderedBaseIndent = 4;
  let orderedIndentOffset: number | null = null;

  const normalized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inFence = !inFence;
      activeOrderedItem = false;
      orderedIndentOffset = null;
      return line;
    }
    if (inFence) {
      return line;
    }
    if (!line.trim()) {
      return line;
    }

    const orderedMatch = line.match(/^(\s*)(\d+)\.(\s*)(.*)$/);
    const orderedContent = orderedMatch?.[4] ?? "";
    const orderedHasWhitespace = ((orderedMatch?.[3] ?? "").length ?? 0) > 0;
    const orderedLooksDecimal =
      Boolean(orderedContent) &&
      !orderedHasWhitespace &&
      /^\d/.test(orderedContent);
    if (orderedMatch && !orderedLooksDecimal) {
      const rawIndent = (orderedMatch[1] ?? "").length;
      const normalizedIndent = rawIndent;
      activeOrderedItem = true;
      orderedBaseIndent = normalizedIndent + 4;
      orderedIndentOffset = null;
      const normalizedBody = orderedContent.trimStart();
      const normalizedLine = normalizedBody
        ? `${spaces(normalizedIndent)}${orderedMatch[2] ?? ""}. ${normalizedBody}`
        : `${spaces(normalizedIndent)}${orderedMatch[2] ?? ""}.`;
      if (normalizedIndent !== rawIndent || normalizedLine !== line) {
        return normalizedLine;
      }
      return line;
    }

    const bulletMatch = line.match(/^(\s*)([-*+])\s+/);
    if (bulletMatch) {
      const rawIndent = (bulletMatch[1] ?? "").length;
      let targetIndent = rawIndent;

      if (activeOrderedItem) {
        if (orderedIndentOffset === null && rawIndent < orderedBaseIndent) {
          orderedIndentOffset = orderedBaseIndent - rawIndent;
        }
        if (orderedIndentOffset !== null) {
          const adjustedIndent = rawIndent + orderedIndentOffset;
          if (adjustedIndent <= orderedBaseIndent + 12) {
            targetIndent = adjustedIndent;
          }
        }
      }

      if (targetIndent !== rawIndent) {
        return `${spaces(targetIndent)}${line.trimStart()}`;
      }
      return line;
    }

    const leadingSpaces = countLeadingSpaces(line);
    if (activeOrderedItem && leadingSpaces < orderedBaseIndent) {
      activeOrderedItem = false;
      orderedIndentOffset = null;
    }
    return line;
  });
  return normalized.join("\n");
}

export function normalizeInlineOrderedListBreaks(value: string) {
  return value.replace(
    /([：:。！？!?；;])\s*(\d+)\.(?!\d)(\S)/g,
    "$1\n$2. $3",
  );
}

export function normalizeGithubBlockquoteAlerts(value: string) {
  if (!value.includes("[!")) {
    return value;
  }
  const lines = value.split(/\r?\n/);
  const normalized: string[] = [];
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^(\s*>+)\s*\[!([A-Z]+)\]\s*$/i);
    if (!match) {
      normalized.push(line);
      continue;
    }

    const tone = (match[2] ?? "").trim().toLowerCase();
    if (!MARKDOWN_ALERT_TONE_SET.has(tone)) {
      normalized.push(line);
      continue;
    }

    changed = true;
    const quotePrefix = match[1] ?? ">";
    normalized.push(
      `${quotePrefix} <span class="markdown-alert-label markdown-alert-label-${tone}">${tone.toUpperCase()}</span>`,
    );

    const nextLine = lines[index + 1] ?? "";
    if (
      nextLine &&
      !/^\s*>+\s*$/.test(nextLine) &&
      getBlockquoteContinuationRegex(quotePrefix).test(nextLine)
    ) {
      normalized.push(quotePrefix);
    }
  }

  return changed ? normalized.join("\n") : value;
}

export function normalizeFragmentedParagraphBreaks(value: string) {
  if (!hasParagraphBreak(value)) {
    return value;
  }
  const paragraphs = value.split(PARAGRAPH_BREAK_SPLIT_REGEX);
  if (paragraphs.length < FRAGMENTED_PARAGRAPH_MIN_RUN) {
    return value;
  }
  const trimmedParagraphs = paragraphs.map((entry) => entry.trim());

  const normalized: string[] = [];
  let changed = false;
  let index = 0;
  while (index < paragraphs.length) {
    const current = paragraphs[index] ?? "";
    const currentQuoteText = extractBlockquoteParagraphText(current);
    if (
      currentQuoteText &&
      shouldMergeFragmentedParagraph(currentQuoteText)
    ) {
      let cursor = index;
      const quoteEntries: string[] = [];
      while (cursor < paragraphs.length) {
        const candidateQuoteText = extractBlockquoteParagraphText(paragraphs[cursor] ?? "");
        if (
          !candidateQuoteText ||
          !shouldMergeFragmentedParagraph(candidateQuoteText)
        ) {
          break;
        }
        quoteEntries.push(candidateQuoteText.trim());
        cursor += 1;
      }

      const { mergeStart, mergeEnd } = trimMergeWindowByPunctuation(
        quoteEntries,
        0,
        quoteEntries.length,
      );
      if (mergeStart > 0) {
        normalized.push(
          ...quoteEntries.slice(0, mergeStart).map((entry) => `> ${entry}`),
        );
      }
      const mergeCandidates = quoteEntries.slice(mergeStart, mergeEnd);
      const mergeTotalChars = mergeCandidates.reduce(
        (sum, entry) => sum + entry.length,
        0,
      );
      if (
        mergeCandidates.length >= FRAGMENTED_PARAGRAPH_MIN_RUN &&
        mergeTotalChars >= FRAGMENTED_PARAGRAPH_MIN_TOTAL_CHARS
      ) {
        normalized.push(`> ${joinFragmentedParagraphs(mergeCandidates)}`);
        changed = true;
      } else {
        normalized.push(
          ...mergeCandidates.map((entry) => `> ${entry}`),
        );
      }
      if (mergeEnd < quoteEntries.length) {
        normalized.push(
          ...quoteEntries
            .slice(mergeEnd)
            .map((entry) => `> ${entry}`),
        );
      }
      index = cursor;
      continue;
    }

    if (!shouldMergeFragmentedParagraph(current)) {
      normalized.push(current);
      index += 1;
      continue;
    }

    let cursor = index;
    while (cursor < paragraphs.length) {
      const candidate = paragraphs[cursor] ?? "";
      if (!shouldMergeFragmentedParagraph(candidate)) {
        break;
      }
      cursor += 1;
    }

    const { mergeStart, mergeEnd } = trimMergeWindowByPunctuation(
      trimmedParagraphs,
      index,
      cursor,
    );

    if (mergeStart > index) {
      normalized.push(...paragraphs.slice(index, mergeStart));
    }

    const mergeCandidates = trimmedParagraphs
      .slice(mergeStart, mergeEnd)
      .filter(Boolean);
    const mergeTotalChars = mergeCandidates.reduce(
      (sum, entry) => sum + entry.length,
      0,
    );
    if (
      mergeCandidates.length >= FRAGMENTED_PARAGRAPH_MIN_RUN &&
      mergeTotalChars >= FRAGMENTED_PARAGRAPH_MIN_TOTAL_CHARS
    ) {
      normalized.push(joinFragmentedParagraphs(mergeCandidates));
      changed = true;
    } else {
      normalized.push(...paragraphs.slice(mergeStart, mergeEnd));
    }

    if (mergeEnd < cursor) {
      normalized.push(...paragraphs.slice(mergeEnd, cursor));
    }
    index = cursor;
  }
  return changed ? normalized.join("\n\n") : value;
}

export function normalizeFragmentedLineBreaks(value: string) {
  if (!value.includes("\n")) {
    return value;
  }
  const blocks = value.split(PARAGRAPH_BREAK_SPLIT_REGEX);
  let changed = false;
  const normalizedBlocks = blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const normalizedLines: string[] = [];
    let index = 0;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (!shouldMergeFragmentedLine(current)) {
        normalizedLines.push(current);
        index += 1;
        continue;
      }
      let cursor = index;
      const run: string[] = [];
      let totalChars = 0;
      while (cursor < lines.length) {
        const candidate = lines[cursor] ?? "";
        if (!shouldMergeFragmentedLine(candidate)) {
          break;
        }
        const trimmed = candidate.trim();
        run.push(trimmed);
        totalChars += trimmed.length;
        cursor += 1;
      }
      const runCompact = run.join("");
      const nonSpaceLength = runCompact.replace(/\s+/g, "").length;
      const cjkCount = (runCompact.match(/[\u4e00-\u9fff]/g) ?? []).length;
      const isCjkDominant = cjkCount >= Math.max(2, Math.floor(nonSpaceLength * 0.35));
      if (
        run.length >= FRAGMENTED_LINE_MIN_RUN &&
        totalChars >= FRAGMENTED_LINE_MIN_TOTAL_CHARS &&
        isCjkDominant
      ) {
        normalizedLines.push(joinFragmentedParagraphs(run));
        changed = true;
      } else {
        normalizedLines.push(...lines.slice(index, cursor));
      }
      index = cursor;
    }
    return normalizedLines.join("\n");
  });
  return changed ? normalizedBlocks.join("\n\n") : value;
}
