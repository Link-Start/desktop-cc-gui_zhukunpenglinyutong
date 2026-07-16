/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitFileBlame } from "../../../services/tauri";
import {
  clearFileGitBlameCacheForTests,
  useFileGitBlame,
} from "./useFileGitBlame";

vi.mock("../../../services/tauri", () => ({
  getGitFileBlame: vi.fn(),
}));

const response = {
  path: "src/main.ts",
  headSha: "abc123",
  lineCount: 2,
  hunks: [
    {
      startLine: 1,
      lineCount: 2,
      commitSha: "abc123",
      author: "Ada",
      authoredAt: 1_700_000_000,
      summary: "Initial commit",
      originalPath: null,
    },
  ],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("useFileGitBlame", () => {
  afterEach(() => {
    clearFileGitBlameCacheForTests();
    vi.clearAllMocks();
  });

  it("does not call the blame bridge while disabled", () => {
    const { result } = renderHook(() =>
      useFileGitBlame({
        workspaceId: "ws-1",
        repositoryRoot: null,
        path: "src/main.ts",
        renderToken: "ws-1\u001fsrc/main.ts\u001f1",
        eligible: true,
        isDirty: false,
      }),
    );

    expect(result.current.status).toBe("disabled");
    expect(getGitFileBlame).not.toHaveBeenCalled();
  });

  it("drops an obsolete response after the active file changes", async () => {
    const firstRequest = createDeferred<typeof response>();
    vi.mocked(getGitFileBlame).mockReturnValueOnce(firstRequest.promise);
    const { result, rerender } = renderHook(
      ({ path }) =>
        useFileGitBlame({
          workspaceId: "ws-1",
          repositoryRoot: null,
          path,
          renderToken: `ws-1\u001f${path}\u001f1`,
          eligible: true,
          isDirty: false,
        }),
      { initialProps: { path: "src/main.ts" } },
    );

    act(() => result.current.toggle());
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(1));
    rerender({ path: "src/other.ts" });
    await act(async () => {
      firstRequest.resolve(response);
      await firstRequest.promise;
    });

    expect(result.current.status).toBe("disabled");
    expect(result.current.response).toBeNull();
  });

  it("marks dirty data stale and refreshes once after save", async () => {
    vi.mocked(getGitFileBlame).mockResolvedValue(response);
    const { result, rerender } = renderHook(
      ({ isDirty, renderToken }) =>
        useFileGitBlame({
          workspaceId: "ws-1",
          repositoryRoot: "packages/app",
          path: "src/main.ts",
          renderToken,
          eligible: true,
          isDirty,
        }),
      {
        initialProps: {
          isDirty: false,
          renderToken: "ws-1\u001fpackages/app/src/main.ts\u001f1",
        },
      },
    );

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getGitFileBlame).toHaveBeenCalledTimes(1);

    rerender({
      isDirty: true,
      renderToken: "ws-1\u001fpackages/app/src/main.ts\u001f1",
    });
    expect(result.current.status).toBe("stale");
    act(() => result.current.refresh());
    expect(getGitFileBlame).toHaveBeenCalledTimes(1);

    rerender({
      isDirty: false,
      renderToken: "ws-1\u001fpackages/app/src/main.ts\u001f2",
    });
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(2));
    expect(getGitFileBlame).toHaveBeenLastCalledWith(
      "ws-1",
      "src/main.ts",
      "packages/app",
    );
  });

  it("drops an obsolete response after the same file render token changes", async () => {
    const obsoleteRequest = createDeferred<typeof response>();
    const currentRequest = createDeferred<typeof response>();
    vi.mocked(getGitFileBlame)
      .mockReturnValueOnce(obsoleteRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const { result, rerender } = renderHook(
      ({ renderToken }) =>
        useFileGitBlame({
          workspaceId: "ws-1",
          repositoryRoot: null,
          path: "src/main.ts",
          renderToken,
          eligible: true,
          isDirty: false,
        }),
      { initialProps: { renderToken: "ws-1\u001fsrc/main.ts\u001f1" } },
    );

    act(() => result.current.toggle());
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(1));
    rerender({ renderToken: "ws-1\u001fsrc/main.ts\u001f2" });
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(2));

    await act(async () => {
      obsoleteRequest.resolve(response);
      await obsoleteRequest.promise;
    });
    expect(result.current.status).toBe("loading");
    expect(result.current.response).toBeNull();

    await act(async () => {
      currentRequest.resolve({ ...response, headSha: "def456" });
      await currentRequest.promise;
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.response?.headSha).toBe("def456");
  });
});
