import { describe, expect, it } from "vitest";

import {
  THREAD_SWITCH_LOADED_REFRESH_MS,
  decideThreadSelectResume,
  isKnownNeverStartedThread,
} from "./threadSelectResumePolicy";

const NOW = 1_700_000_000_000;

const BASE = {
  isLoaded: false,
  isProcessing: false,
  historyLoadingFailed: false,
  isEmptySurface: true,
  isNeverStarted: false,
  nowMs: NOW,
  lastRefreshAtMs: 0,
  lastEmptySurfaceResumeAtMs: 0,
};

describe("isKnownNeverStartedThread", () => {
  it("treats pending ids as never-started", () => {
    expect(
      isKnownNeverStartedThread({
        threadId: "claude-pending-1",
        isLoaded: false,
        itemCount: 0,
      }),
    ).toBe(true);
  });

  it("treats explicit empty disk metadata as never-started", () => {
    expect(
      isKnownNeverStartedThread({
        threadId: "claude:new-session",
        isLoaded: false,
        itemCount: 0,
        summary: { sizeBytes: 0 },
      }),
    ).toBe(true);
  });

  it("does not treat a missing summary as never-started", () => {
    expect(
      isKnownNeverStartedThread({
        threadId: "claude:session-history",
        isLoaded: false,
        itemCount: 0,
      }),
    ).toBe(false);
  });

  it("does not treat a summary that omitted size as never-started", () => {
    expect(
      isKnownNeverStartedThread({
        threadId: "claude:session-history",
        isLoaded: false,
        itemCount: 0,
        summary: {},
      }),
    ).toBe(false);
  });

  it("does not treat a history hint as never-started", () => {
    expect(
      isKnownNeverStartedThread({
        threadId: "claude:session-history",
        isLoaded: false,
        itemCount: 0,
        summary: { sizeBytes: 2048, physicalPath: "/tmp/session.jsonl" },
      }),
    ).toBe(false);
  });
});

describe("decideThreadSelectResume", () => {
  it("skips while the thread is processing", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        isProcessing: true,
      }),
    ).toEqual({ action: "skip", reason: "processing" });
  });

  it("blocks automatic resume when prior history load failed", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        historyLoadingFailed: true,
        lastRefreshAtMs: NOW,
        lastEmptySurfaceResumeAtMs: NOW,
      }),
    ).toEqual({ action: "skip", reason: "failed" });
  });

  it("skips known never-started sessions", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        isNeverStarted: true,
      }),
    ).toEqual({ action: "skip", reason: "never-started" });
  });

  it("does not force-resume a loaded empty Claude surface inside the refresh window", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        isLoaded: true,
        lastRefreshAtMs: NOW - 1_000,
        lastEmptySurfaceResumeAtMs: NOW - 1_000,
      }),
    ).toEqual({ action: "skip", reason: "loaded-fresh" });
  });

  it("refreshes a loaded empty surface after the cooldown", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        isLoaded: true,
        lastRefreshAtMs: NOW - THREAD_SWITCH_LOADED_REFRESH_MS,
        lastEmptySurfaceResumeAtMs: NOW - THREAD_SWITCH_LOADED_REFRESH_MS,
      }),
    ).toEqual({ action: "resume", reason: "loaded-stale", force: false });
  });

  it("resumes an unloaded empty surface once, then cools down", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
      }),
    ).toEqual({ action: "resume", reason: "empty-first", force: false });

    expect(
      decideThreadSelectResume({
        ...BASE,
        nowMs: NOW + 1_000,
        lastEmptySurfaceResumeAtMs: NOW,
      }),
    ).toEqual({ action: "skip", reason: "empty-cooldown" });
  });

  it("still resumes unloaded non-empty threads", () => {
    expect(
      decideThreadSelectResume({
        ...BASE,
        isEmptySurface: false,
      }),
    ).toEqual({ action: "resume", reason: "unloaded", force: false });
  });
});
