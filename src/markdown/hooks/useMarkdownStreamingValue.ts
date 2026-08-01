import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeProgressiveRevealChunkChars,
  normalizeProgressiveRevealStepMs,
  resolveAdaptiveProgressiveRevealStepMs,
  resolveProgressiveRevealValue,
} from "../runtime/LiveMarkdown";

type MarkdownStreamingValueOptions = {
  value: string;
  streamingThrottleMs: number;
  progressiveReveal: boolean;
  progressiveRevealStepMs: number;
  progressiveRevealChunkChars: number;
};

export function useMarkdownStreamingValue({
  value,
  streamingThrottleMs,
  progressiveReveal,
  progressiveRevealStepMs,
  progressiveRevealChunkChars,
}: MarkdownStreamingValueOptions) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdateRef = useRef(Date.now());
  const throttleTimerRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const latestValueRef = useRef(value);
  const previousThrottleMsRef = useRef(Math.max(0, streamingThrottleMs));
  const resolvedThrottleMs = Math.max(0, streamingThrottleMs);
  latestValueRef.current = value;

  const scheduleThrottledValueUpdate = useCallback((nextValue: string) => {
    setThrottledValue((currentValue) => currentValue === nextValue ? currentValue : nextValue);
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (previousThrottleMsRef.current !== resolvedThrottleMs) {
      previousThrottleMsRef.current = resolvedThrottleMs;
      if (throttleTimerRef.current) window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = 0;
      scheduleThrottledValueUpdate(value);
      lastUpdateRef.current = now;
      return;
    }
    const elapsed = now - lastUpdateRef.current;
    if (resolvedThrottleMs === 0 || elapsed >= resolvedThrottleMs) {
      scheduleThrottledValueUpdate(value);
      lastUpdateRef.current = now;
      return;
    }
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current = 0;
      if (!mountedRef.current) return;
      scheduleThrottledValueUpdate(latestValueRef.current);
      lastUpdateRef.current = Date.now();
    }, resolvedThrottleMs - elapsed);
  }, [resolvedThrottleMs, scheduleThrottledValueUpdate, value]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (throttleTimerRef.current) window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = 0;
    };
  }, []);

  const resolvedStepMs = normalizeProgressiveRevealStepMs(progressiveRevealStepMs);
  const resolvedChunkChars = normalizeProgressiveRevealChunkChars(progressiveRevealChunkChars);
  const [progressiveValue, setProgressiveValue] = useState(() => progressiveReveal
    ? resolveProgressiveRevealValue("", value, resolvedChunkChars)
    : value);
  const progressiveTimerRef = useRef<number>(0);
  const latestTargetRef = useRef(value);
  const previousProgressiveRevealRef = useRef(progressiveReveal);

  const scheduleProgressiveValueUpdate = useCallback((updater: string | ((current: string) => string)) => {
    setProgressiveValue((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return next === current ? current : next;
    });
  }, []);

  useEffect(() => {
    if (!progressiveReveal) {
      if (progressiveTimerRef.current) window.clearTimeout(progressiveTimerRef.current);
      progressiveTimerRef.current = 0;
      latestTargetRef.current = throttledValue;
      scheduleProgressiveValueUpdate(throttledValue);
      previousProgressiveRevealRef.current = false;
      return;
    }
    latestTargetRef.current = throttledValue;
    scheduleProgressiveValueUpdate((current) => {
      const wasProgressive = previousProgressiveRevealRef.current;
      previousProgressiveRevealRef.current = true;
      return resolveProgressiveRevealValue(
        wasProgressive ? current : "",
        throttledValue,
        resolvedChunkChars,
      );
    });
  }, [progressiveReveal, resolvedChunkChars, scheduleProgressiveValueUpdate, throttledValue]);

  useEffect(() => {
    if (!progressiveReveal || progressiveValue === latestTargetRef.current || progressiveTimerRef.current) {
      return undefined;
    }
    const pendingLength = Math.max(0, latestTargetRef.current.length - progressiveValue.length);
    const adaptiveStepMs = resolveAdaptiveProgressiveRevealStepMs(
      progressiveValue.length,
      pendingLength,
      resolvedStepMs,
    );
    progressiveTimerRef.current = window.setTimeout(() => {
      progressiveTimerRef.current = 0;
      if (!mountedRef.current) return;
      scheduleProgressiveValueUpdate((current) =>
        resolveProgressiveRevealValue(current, latestTargetRef.current, resolvedChunkChars));
    }, adaptiveStepMs);
    return undefined;
  }, [progressiveReveal, progressiveValue, resolvedChunkChars, resolvedStepMs, scheduleProgressiveValueUpdate]);

  useEffect(() => () => {
    if (progressiveTimerRef.current) window.clearTimeout(progressiveTimerRef.current);
    progressiveTimerRef.current = 0;
  }, []);

  return {
    throttledValue,
    renderValue: progressiveReveal ? progressiveValue : throttledValue,
  };
}
