/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addHistoryItem,
  clearAllHistory,
  clearLowImportanceHistory,
  deleteHistoryItem,
  recordHistory,
  subscribeInputHistoryChanged,
  updateHistoryItem,
} from "./useInputHistoryStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => ({ items: [], counts: {} })),
}));

describe("useInputHistoryStore change events", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllHistory();
  });

  afterEach(() => {
    clearAllHistory();
    localStorage.clear();
  });

  it("emits once per mutation across all write APIs", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInputHistoryChanged(listener);

    recordHistory("alphaentry");
    addHistoryItem("betaentry", 2);
    updateHistoryItem("betaentry", "gammaentry", 3);
    deleteHistoryItem("alphaentry");
    clearLowImportanceHistory(1);
    clearAllHistory();

    expect(listener).toHaveBeenCalledTimes(6);
    unsubscribe();
  });

  it("does not emit for blank records that mutate nothing", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInputHistoryChanged(listener);

    recordHistory("   ");

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInputHistoryChanged(listener);
    unsubscribe();

    recordHistory("alphaentry");

    expect(listener).not.toHaveBeenCalled();
  });
});
