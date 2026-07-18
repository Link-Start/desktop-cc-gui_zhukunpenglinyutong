// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listBuiltInAgents,
  setBuiltInAgentDivisionEnabled,
  setBuiltInAgentEnabled,
} from "../../../services/tauri";
import type { BuiltInAgentCatalog } from "../../../types";
import { useBuiltInAgentCatalog } from "./useBuiltInAgentCatalog";

const locale = {
  language: "zh",
  resolvedLanguage: "zh",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: locale }),
}));

vi.mock("../../../services/tauri", () => ({
  listBuiltInAgents: vi.fn(),
  setBuiltInAgentDivisionEnabled: vi.fn(),
  setBuiltInAgentEnabled: vi.fn(),
}));

const listBuiltInAgentsMock = vi.mocked(listBuiltInAgents);
const setBuiltInAgentDivisionEnabledMock = vi.mocked(
  setBuiltInAgentDivisionEnabled,
);
const setBuiltInAgentEnabledMock = vi.mocked(setBuiltInAgentEnabled);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function catalog(displayName: string): BuiltInAgentCatalog {
  return {
    providerId: "agency-agents",
    displayName,
    sourceUrl: "https://github.com/msitarzewski/agency-agents",
    sourceRevision: "revision",
    license: "MIT",
    divisions: [],
    agents: [],
  };
}

describe("useBuiltInAgentCatalog", () => {
  beforeEach(() => {
    locale.language = "zh";
    locale.resolvedLanguage = "zh";
    listBuiltInAgentsMock.mockReset();
    setBuiltInAgentDivisionEnabledMock.mockReset();
    setBuiltInAgentEnabledMock.mockReset();
  });

  it("ignores an older locale request that resolves after the latest request", async () => {
    const firstRequest = deferred<BuiltInAgentCatalog>();
    const secondRequest = deferred<BuiltInAgentCatalog>();
    listBuiltInAgentsMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(() =>
      useBuiltInAgentCatalog({
        active: true,
        onUpdateAppSettings: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(listBuiltInAgentsMock).toHaveBeenCalledTimes(1);
    });

    locale.language = "en";
    locale.resolvedLanguage = "en";
    rerender();

    await waitFor(() => {
      expect(listBuiltInAgentsMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondRequest.resolve(catalog("Latest catalog"));
      await secondRequest.promise;
    });
    expect(result.current.catalog?.displayName).toBe("Latest catalog");

    await act(async () => {
      firstRequest.resolve(catalog("Stale catalog"));
      await firstRequest.promise;
    });
    expect(result.current.catalog?.displayName).toBe("Latest catalog");
  });
});
