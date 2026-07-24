import { engineSendMessageSync } from "../../../services/tauri";
import { parseModelStructuredJsonObject } from "../../../services/modelStructuredOutput";
import type { EngineType } from "../../../types";
import { normalizeGitChangePath } from "../../git/utils/gitChangeModel";
import type {
  SemanticDiffEntry,
  SemanticEvidenceRef,
  TurnSemanticReview,
  TurnSemanticReviewFact,
} from "../../git/utils/semanticDiffSummary";

const MAX_REVIEW_FACTS = 8;
const MAX_FACT_TEXT_CHARS = 280;
const MAX_DIFF_CHARS_PER_FILE = 3000;
const MAX_TOTAL_DIFF_CHARS = 14000;
const REVIEW_TIMEOUT_MS = 60_000;

const SEMANTIC_REVIEW_AUTO_SESSION = {
  sessionPurpose: "semantic-diff-review",
  visibility: "hidden",
  ownerFeature: "session-activity",
  autoArchive: true,
  createdBy: "system",
} as const;

const FACT_CATEGORIES = new Set<TurnSemanticReviewFact["category"]>([
  "intent",
  "behavior",
  "risk",
  "validation",
]);
const FACT_CONFIDENCES = new Set<TurnSemanticReviewFact["confidence"]>([
  "high",
  "medium",
  "low",
]);

type PreparedReviewEntry = {
  path: string;
  status: string;
  diff: string;
  omitted: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateText(value: string, limit: number) {
  return value.length > limit ? value.slice(0, limit) : value;
}

// 预处理本 turn 的 diff entries:归一化 path、跳过图片、按预算截断
function prepareReviewEntries(entries: SemanticDiffEntry[]): PreparedReviewEntry[] {
  const prepared: PreparedReviewEntry[] = [];
  let totalChars = 0;
  for (const entry of entries) {
    if (entry.isImage) {
      continue;
    }
    const path = normalizeGitChangePath(entry.path);
    if (!path) {
      continue;
    }
    const remaining = MAX_TOTAL_DIFF_CHARS - totalChars;
    if (remaining <= 0) {
      prepared.push({ path, status: entry.status, diff: "", omitted: true });
      continue;
    }
    const budget = Math.min(MAX_DIFF_CHARS_PER_FILE, remaining);
    const rawDiff = entry.diff ?? "";
    const omitted = rawDiff.length > budget;
    prepared.push({
      path,
      status: entry.status,
      diff: truncateText(rawDiff, budget),
      omitted,
    });
    totalChars += Math.min(rawDiff.length, budget);
  }
  return prepared;
}

export function buildTurnSemanticReviewPrompt(
  entries: SemanticDiffEntry[],
  language: string,
): string {
  const prepared = prepareReviewEntries(entries);
  const fileSections = prepared
    .map((entry) => {
      const body = entry.omitted
        ? `${entry.diff}\n[diff truncated for budget]`.trim()
        : entry.diff;
      return [
        `### file: ${entry.path} (status: ${entry.status})`,
        body || "[no diff text available]",
      ].join("\n");
    })
    .join("\n\n");
  const pathList = prepared.map((entry) => `- ${entry.path}`).join("\n");
  const outputLanguage = language.toLowerCase().startsWith("zh") ? "Chinese" : "English";

  return [
    "You are a code review assistant explaining one conversation turn's file changes.",
    "Read the unified diffs below and produce a compact semantic review as explain layer.",
    "",
    "Requirements:",
    `- Output fact text in ${outputLanguage}.`,
    "- Ground every fact in the provided diffs; never invent evidence that is not visible.",
    "- Each fact MUST cite at least one evidence path from the allowed file list below.",
    "- evidence.line is optional; when present it must be a new-file-side line number from the diff.",
    "- Prefer a few high-signal facts over many weak ones; output at most 8 facts.",
    "- Respond with exactly one JSON object and nothing else: no markdown fence, no commentary.",
    "",
    "JSON schema:",
    '{"facts":[{"category":"intent|behavior|risk|validation","text":"...","confidence":"high|medium|low","evidence":[{"path":"...","line":123}]}]}',
    "",
    "Allowed evidence file paths:",
    pathList || "- (none)",
    "",
    "Diffs:",
    fileSections || "(no file changes)",
  ].join("\n");
}

type RawReviewPayload = {
  facts: unknown[];
};

function isRawReviewPayload(value: unknown): value is RawReviewPayload {
  return isRecord(value) && Array.isArray(value.facts);
}

function normalizeFactEvidenceRefs(
  value: unknown,
  allowedPaths: Set<string>,
): SemanticEvidenceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const refs: SemanticEvidenceRef[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.path !== "string") {
      continue;
    }
    const path = normalizeGitChangePath(item.path);
    if (!path || !allowedPaths.has(path)) {
      continue;
    }
    const line =
      typeof item.line === "number" && Number.isInteger(item.line) && item.line > 0
        ? item.line
        : null;
    if (line !== null) {
      refs.push({ type: "diffHunk", id: `${path}:${line}`, path, line });
    } else {
      refs.push({ type: "file", id: path, path });
    }
  }
  return refs;
}

function normalizeFact(value: unknown, allowedPaths: Set<string>): TurnSemanticReviewFact | null {
  if (!isRecord(value)) {
    return null;
  }
  const category = value.category as TurnSemanticReviewFact["category"];
  const confidence = value.confidence as TurnSemanticReviewFact["confidence"];
  if (!FACT_CATEGORIES.has(category) || !FACT_CONFIDENCES.has(confidence)) {
    return null;
  }
  if (typeof value.text !== "string" || !value.text.trim()) {
    return null;
  }
  const evidenceRefs = normalizeFactEvidenceRefs(value.evidence, allowedPaths);
  if (evidenceRefs.length === 0) {
    return null;
  }
  return {
    category,
    confidence,
    text: truncateText(value.text.trim(), MAX_FACT_TEXT_CHARS),
    evidenceRefs,
  };
}

// 解析模型输出为 TurnSemanticReview;任何整体解析失败返回 null(静默降级)
export function parseTurnSemanticReviewResponse(
  text: string,
  entries: SemanticDiffEntry[],
): TurnSemanticReview | null {
  const allowedPaths = new Set(
    prepareReviewEntries(entries).map((entry) => entry.path),
  );
  if (allowedPaths.size === 0) {
    return null;
  }
  let payload: RawReviewPayload;
  try {
    payload = parseModelStructuredJsonObject<RawReviewPayload>({
      text,
      validator: isRawReviewPayload,
      payloadDescription: "semantic review facts payload",
    });
  } catch {
    return null;
  }
  const facts = payload.facts
    .map((fact) => normalizeFact(fact, allowedPaths))
    .filter((fact): fact is TurnSemanticReviewFact => fact !== null)
    .slice(0, MAX_REVIEW_FACTS);
  return {
    source: "ai",
    generatedAt: Date.now(),
    facts,
  };
}

async function requestReviewWithEngine(options: {
  workspaceId: string;
  prompt: string;
  engine: EngineType;
}): Promise<string> {
  const response = await engineSendMessageSync(options.workspaceId, {
    text: options.prompt,
    engine: options.engine,
    accessMode: "read-only",
    continueSession: false,
    autoSession: SEMANTIC_REVIEW_AUTO_SESSION,
  });
  return response.text;
}

function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutRequest = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`semantic review timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([request, timeoutRequest]).finally(() => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

// 生成 turn 级 AI review;永不 throw,失败/解析失败一律返回 null 供调用方静默降级
export async function requestTurnSemanticReview(options: {
  workspaceId: string;
  entries: SemanticDiffEntry[];
  language: string;
}): Promise<TurnSemanticReview | null> {
  const prompt = buildTurnSemanticReviewPrompt(options.entries, options.language);
  const engines: EngineType[] = ["claude", "codex"];
  for (const engine of engines) {
    try {
      const text = await withTimeout(
        requestReviewWithEngine({
          workspaceId: options.workspaceId,
          prompt,
          engine,
        }),
        REVIEW_TIMEOUT_MS,
      );
      const review = parseTurnSemanticReviewResponse(text, options.entries);
      if (review) {
        return review;
      }
      // 解析失败不必换引擎重试:同一 prompt 的确定性输出大概率同样失败,直接降级
      return null;
    } catch {
      // 当前引擎不可用,静默回退下一个引擎
    }
  }
  return null;
}
