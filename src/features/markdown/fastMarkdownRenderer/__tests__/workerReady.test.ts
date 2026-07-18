import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  finalizeFastMarkdownArtifact,
} from "../compile";
import { compileFastMarkdownToUnsafeArtifact } from "../compileCore";
import { clearFastMarkdownRenderCache } from "../cache";
import { extractMarkdownOutline } from "../parserOutline";
import { extractHeavyBlocks } from "../heavyBlocks";
import { sanitizeFastMarkdownHtml } from "../sanitize";
import {
  resolveFastMarkdownProfileInputs,
  resolveFastMarkdownRendererProfile,
} from "../resolveProfile";
import { COMBINED_FIXTURE, SIMPLE_HEADING_PARAGRAPH } from "./fixtures";

beforeEach(() => {
  clearFastMarkdownRenderCache();
});

afterEach(() => {
  clearFastMarkdownRenderCache();
});

/**
 * These tests document the Worker-ready boundary for the fast
 * Markdown renderer. The contract:
 *
 * 1. Worker precompute must be callable without React or mounted DOM.
 * 2. The unsafe artifact must be a plain JSON-serializable object
 *    so it can cross `postMessage` before main-thread sanitization.
 * 3. The parser-side helpers (`extractMarkdownOutline`,
 *    `extractHeavyBlocks`, `attachSourceLineAttrs`,
 *    `resolveFastMarkdownProfileInputs`,
 *    `resolveFastMarkdownRendererProfile`) must be pure functions
 *    so they can be called from either the main thread or a
 *    Worker without environment dependencies.
 */
describe("Worker-ready boundary", () => {
  it("worker precompute returns an explicitly unsafe DOM-free artifact", async () => {
    const result = await compileFastMarkdownToUnsafeArtifact({
      documentKey: "doc-worker-ready",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });
    expect(result).toBeTypeOf("object");
    expect(Object.keys(result).sort()).toEqual([
      "cacheKey",
      "contentHash",
      "diagnostics",
      "heavyBlocks",
      "outline",
      "rendererProfile",
      "sanitization",
      "sourceLineAnchors",
      "unsafeHtml",
    ]);
    expect(result.sanitization).toBe("main-thread-required");
  });

  it("worker artifact round-trips through JSON serialization", async () => {
    const result = await compileFastMarkdownToUnsafeArtifact({
      documentKey: "doc-json-roundtrip",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
    });
    const serialized = JSON.stringify(result);
    const revived = JSON.parse(serialized);
    expect(revived).toEqual(result);
  });

  it("main-thread finalization sanitizes a forged unsafe worker artifact", async () => {
    const artifact = await compileFastMarkdownToUnsafeArtifact({
      documentKey: "doc-main-thread-sanitize",
      rawMarkdown: "# Safe",
      rendererProfile: "fast-html",
    });
    const result = finalizeFastMarkdownArtifact({
      ...artifact,
      unsafeHtml:
        `<a href="javascript:alert(1)">x</a><script>alert(1)</script>` +
        `<img src="x" onerror="alert(1)">`,
    });

    expect(result.html).not.toMatch(/javascript:/i);
    expect(result.html).not.toMatch(/<script/i);
    expect(result.html).not.toMatch(/onerror=/i);
    expect(result.diagnostics.sanitizeDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("sanitize fallback works without a DOM", () => {
    const dirty = `<a href="javascript:alert(1)">x</a><script>alert(1)</script><img src="x" onerror="alert(1)">`;
    const sanitized = sanitizeFastMarkdownHtml(dirty);
    expect(sanitized.html).not.toMatch(/javascript:/i);
    expect(sanitized.html).not.toMatch(/<script/i);
    expect(sanitized.html).not.toMatch(/onerror=/i);
  });

  it("profile selector is pure and deterministic", () => {
    const inputsA = resolveFastMarkdownProfileInputs({
      rawMarkdown: COMBINED_FIXTURE,
      featureFlags: {
        fastHtmlRendererEnabled: true,
        boundedFastHtmlRendererEnabled: true,
      },
    });
    const inputsB = resolveFastMarkdownProfileInputs({
      rawMarkdown: COMBINED_FIXTURE,
      featureFlags: {
        fastHtmlRendererEnabled: true,
        boundedFastHtmlRendererEnabled: true,
      },
    });
    // Same inputs produce the same profile id; no clock, no
    // performance.now, no module-level mutable state.
    expect(inputsA.totalSourceLines).toBe(inputsB.totalSourceLines);
    expect(inputsA.rawMarkdownLength).toBe(inputsB.rawMarkdownLength);
    expect(resolveFastMarkdownRendererProfile(inputsA)).toBe(
      resolveFastMarkdownRendererProfile(inputsB),
    );
  });

  it("parser-side helpers do not depend on React or DOM", () => {
    const root = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .parse(SIMPLE_HEADING_PARAGRAPH);
    const outline = extractMarkdownOutline(root, 1);
    const heavyBlocks = extractHeavyBlocks(root, 1);
    // Outline / heavy blocks must be plain JSON-serializable
    // objects. We don't need to walk the HAST here — the
    // round-trip test above already exercises the full pipeline.
    expect(JSON.parse(JSON.stringify(outline))).toEqual(outline);
    expect(JSON.parse(JSON.stringify(heavyBlocks))).toEqual(heavyBlocks);
  });
});
