import { describe, expect, it } from "vitest";
import {
  isProgrammaticScrollEcho,
  isRecentUserScrollIntent,
  isScrollIntentKey,
  PROGRAMMATIC_SCROLL_ECHO_GRACE_MS,
  readScrollGeometrySnapshot,
  recordProgrammaticScrollFingerprint,
  resolveClampedScrollTop,
  type ProgrammaticScrollFingerprint,
} from "./messagesScrollEcho";

const fingerprint = (
  scrollTop: number,
  recordedAt: number,
  source: ProgrammaticScrollFingerprint["source"] = "write",
): ProgrammaticScrollFingerprint => ({ recordedAt, scrollTop, source });

const BASE_INPUT = {
  eventScrollTop: 1680,
  echoFingerprints: [fingerprint(1680, 10_000), fingerprint(1700, 10_000)],
  tolerancePx: 2,
  now: 10_000,
  hasRecentUserScrollIntent: false,
};

describe("isProgrammaticScrollEcho", () => {
  it("accepts a matching fingerprint while a programmatic run is active", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: true,
        echoFingerprints: [fingerprint(1680, 1)],
      }),
    ).toBe(true);
  });

  it("accepts the matching fingerprint at the exact post-write grace boundary", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        echoFingerprints: [
          fingerprint(1680, 10_000 - PROGRAMMATIC_SCROLL_ECHO_GRACE_MS),
        ],
      }),
    ).toBe(true);
  });

  it("rejects the matching fingerprint one millisecond after its grace expires", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        echoFingerprints: [
          fingerprint(1680, 10_000 - PROGRAMMATIC_SCROLL_ECHO_GRACE_MS - 1),
        ],
      }),
    ).toBe(false);
  });

  it("does not let a newer write renew an older unrelated fingerprint", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        echoFingerprints: [
          fingerprint(1680, 1_000),
          fingerprint(1700, 9_900),
        ],
      }),
    ).toBe(false);
  });

  it("lets explicit user intent override an otherwise valid echo", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: true,
        hasRecentUserScrollIntent: true,
      }),
    ).toBe(false);
  });

  it("rejects non-fingerprint positions inside the grace window", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        eventScrollTop: 400,
      }),
    ).toBe(false);
  });

  it("honours the tolerance band around the matching fingerprint", () => {
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        eventScrollTop: 1682,
      }),
    ).toBe(true);
    expect(
      isProgrammaticScrollEcho({
        ...BASE_INPUT,
        hasActiveProgrammaticRun: false,
        eventScrollTop: 1683,
      }),
    ).toBe(false);
  });
});

describe("recordProgrammaticScrollFingerprint", () => {
  it("refreshes only the same position and source", () => {
    const fingerprints = [
      fingerprint(1680, 100, "write"),
      fingerprint(1680, 200, "clamp"),
    ];

    recordProgrammaticScrollFingerprint(
      fingerprints,
      fingerprint(1680, 300, "write"),
      32,
    );

    expect(fingerprints).toEqual([
      fingerprint(1680, 200, "clamp"),
      fingerprint(1680, 300, "write"),
    ]);
  });

  it("evicts the oldest entries at the configured bound", () => {
    const fingerprints = [fingerprint(100, 100), fingerprint(200, 200)];
    recordProgrammaticScrollFingerprint(
      fingerprints,
      fingerprint(300, 300),
      2,
    );
    expect(fingerprints.map((item) => item.scrollTop)).toEqual([200, 300]);
  });
});

describe("user scroll intent", () => {
  it("treats time origin zero as a valid intent timestamp", () => {
    expect(isRecentUserScrollIntent(0, 500)).toBe(true);
    expect(isRecentUserScrollIntent(0, 501)).toBe(false);
  });

  it("rejects missing and future intent timestamps", () => {
    expect(isRecentUserScrollIntent(null, 10)).toBe(false);
    expect(isRecentUserScrollIntent(20, 10)).toBe(false);
  });

  it("recognizes scrolling keys without treating ordinary input as scroll intent", () => {
    expect(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].every(
      isScrollIntentKey,
    )).toBe(true);
    expect(isScrollIntentKey("Enter")).toBe(false);
  });
});

describe("scroll clamp geometry", () => {
  it("reads the current maximum scroll range", () => {
    expect(
      readScrollGeometrySnapshot({
        scrollHeight: 6000,
        clientHeight: 720,
        scrollTop: 5280,
      }),
    ).toEqual({ maxScrollTop: 5280, scrollTop: 5280 });
  });

  it("recognizes a browser clamp after the range shrinks past the old position", () => {
    expect(
      resolveClampedScrollTop(
        { maxScrollTop: 5280, scrollTop: 5280 },
        { maxScrollTop: 1680, scrollTop: 1680 },
        2,
      ),
    ).toBe(1680);
  });

  it("rejects initial observation, growth, in-range positions, and non-target positions", () => {
    expect(
      resolveClampedScrollTop(null, { maxScrollTop: 1680, scrollTop: 1680 }, 2),
    ).toBeNull();
    expect(
      resolveClampedScrollTop(
        { maxScrollTop: 1680, scrollTop: 1680 },
        { maxScrollTop: 5280, scrollTop: 1680 },
        2,
      ),
    ).toBeNull();
    expect(
      resolveClampedScrollTop(
        { maxScrollTop: 5280, scrollTop: 1000 },
        { maxScrollTop: 1680, scrollTop: 1000 },
        2,
      ),
    ).toBeNull();
    expect(
      resolveClampedScrollTop(
        { maxScrollTop: 5280, scrollTop: 5280 },
        { maxScrollTop: 1680, scrollTop: 1200 },
        2,
      ),
    ).toBeNull();
  });
});
