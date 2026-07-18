import { getCachedFastMarkdownRender, setCachedFastMarkdownRender } from "./cache";
import {
  compileFastMarkdownToUnsafeArtifact,
  createFastMarkdownCompileIdentity,
} from "./compileCore";
import { sanitizeFastMarkdownHtml } from "./sanitize";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownRenderResult,
  FastMarkdownRendererProfileId,
  FastMarkdownUnsafeArtifact,
} from "./types";

export async function compileFastMarkdown(
  args: CompileFastMarkdownArgs,
): Promise<FastMarkdownRenderResult> {
  const cached = getCachedFastMarkdownResult(args);
  if (cached) {
    return cached;
  }
  const artifact = await compileFastMarkdownToUnsafeArtifact(args);
  return finalizeFastMarkdownArtifact(artifact);
}

export function getCachedFastMarkdownResult(
  args: CompileFastMarkdownArgs,
): FastMarkdownRenderResult | null {
  const { cacheKey } = createFastMarkdownCompileIdentity(args);
  const cached = getCachedFastMarkdownRender(cacheKey);
  return cached ? withCacheHitDiagnostics(cached) : null;
}

export function finalizeFastMarkdownArtifact(
  artifact: FastMarkdownUnsafeArtifact,
): FastMarkdownRenderResult {
  const cached = getCachedFastMarkdownRender(artifact.cacheKey);
  if (cached) {
    return withCacheHitDiagnostics(cached);
  }
  if (artifact.diagnostics.fallbackReason === "compile-failed") {
    return toRenderResult(artifact, "", 0, "compile-failed");
  }

  try {
    const sanitizeStart = performance.now();
    const sanitized = sanitizeFastMarkdownHtml(artifact.unsafeHtml);
    const sanitizeDurationMs = performance.now() - sanitizeStart;
    const fallbackReason = sanitized.sanitizedSuccessfully
      ? artifact.diagnostics.fallbackReason
      : "sanitizer-failed";
    const result = toRenderResult(
      artifact,
      sanitized.html,
      sanitizeDurationMs,
      fallbackReason,
    );
    if (fallbackReason === "none") {
      setCachedFastMarkdownRender(artifact.cacheKey, result);
    }
    return result;
  } catch {
    return toRenderResult(artifact, "", 0, "sanitizer-failed");
  }
}

function toRenderResult(
  artifact: FastMarkdownUnsafeArtifact,
  html: string,
  sanitizeDurationMs: number,
  fallbackReason: FastMarkdownRenderResult["diagnostics"]["fallbackReason"],
): FastMarkdownRenderResult {
  return {
    cacheKey: artifact.cacheKey,
    contentHash: artifact.contentHash,
    html,
    outline: artifact.outline,
    sourceLineAnchors: artifact.sourceLineAnchors,
    heavyBlocks: artifact.heavyBlocks,
    diagnostics: {
      ...artifact.diagnostics,
      sanitizeDurationMs,
      fallbackReason,
    },
    rendererProfile: artifact.rendererProfile,
  };
}

function withCacheHitDiagnostics(
  cached: FastMarkdownRenderResult,
): FastMarkdownRenderResult {
  return {
    ...cached,
    diagnostics: {
      ...cached.diagnostics,
      cacheState: "hit",
    },
  };
}

export function isFastMarkdownProfile(id: string): id is FastMarkdownRendererProfileId {
  return (
    id === "rich-react" ||
    id === "fast-html" ||
    id === "bounded-fast-html" ||
    id === "low-cost-readable"
  );
}
