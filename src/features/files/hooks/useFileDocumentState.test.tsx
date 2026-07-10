/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileReadTarget } from "../../../utils/workspacePaths";
import {
  clearFileDocumentSessionCacheForTests,
  useFileDocumentState,
} from "./useFileDocumentState";
import {
  readExternalAbsoluteFile,
  readExternalSpecFile,
  readWorkspaceFile,
  writeExternalSpecFile,
  writeWorkspaceFile,
} from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
  readExternalSpecFile: vi.fn(),
  readExternalAbsoluteFile: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  writeExternalSpecFile: vi.fn(),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

type HookProps = {
  workspaceId: string;
  customSpecRoot: string | null;
  workspaceRelativeFilePath: string;
  fileReadTarget: FileReadTarget;
  skipTextRead: boolean;
  externalAbsoluteReadOnlyMessage: string;
};

function makeWorkspaceTarget(path: string): FileReadTarget {
  return {
    domain: "workspace",
    normalizedInputPath: path,
    workspaceRelativePath: path,
  };
}

describe("useFileDocumentState", () => {
  afterEach(() => {
    clearFileDocumentSessionCacheForTests();
    vi.clearAllMocks();
  });

  it("clears stale content when the target path becomes invalid", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });

    const { result, rerender } = renderHook(
      (props: HookProps) => useFileDocumentState(props),
      {
        initialProps: {
          workspaceId: "ws-invalid",
          customSpecRoot: null,
          workspaceRelativeFilePath: "src/value.ts",
          fileReadTarget: makeWorkspaceTarget("src/value.ts"),
          skipTextRead: false,
          externalAbsoluteReadOnlyMessage: "read only",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBe("const value = 1;");
    });

    rerender({
      workspaceId: "ws-invalid",
      customSpecRoot: null,
      workspaceRelativeFilePath: "",
      fileReadTarget: {
        domain: "invalid",
        normalizedInputPath: "",
        workspaceRelativePath: "",
      },
      skipTextRead: false,
      externalAbsoluteReadOnlyMessage: "read only",
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("Invalid file path");
      expect(result.current.content).toBe("");
      expect(result.current.truncated).toBe(false);
    });
  });

  it("prevents duplicate save requests while the current save is still in flight", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });

    let resolveSave: (() => void) | null = null;
    vi.mocked(writeWorkspaceFile).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHook(
      (props: HookProps) => useFileDocumentState(props),
      {
        initialProps: {
          workspaceId: "ws-save",
          customSpecRoot: null,
          workspaceRelativeFilePath: "src/value.ts",
          fileReadTarget: makeWorkspaceTarget("src/value.ts"),
          skipTextRead: false,
          externalAbsoluteReadOnlyMessage: "read only",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBe("const value = 1;");
    });

    act(() => {
      result.current.setContent("const value = 2;");
    });
    await waitFor(() => {
      expect(result.current.isDirty).toBe(true);
    });
    expect(result.current.content).toBe("const value = 2;");
    expect(result.current.savedContentRef.current).toBe("const value = 1;");
    expect(result.current.isSaving).toBe(false);

    let firstSave!: Promise<boolean>;
    let secondSave!: Promise<boolean>;
    await act(async () => {
      firstSave = result.current.handleSave();
      await Promise.resolve();
    });

    expect(vi.mocked(writeWorkspaceFile)).toHaveBeenCalledTimes(1);

    await act(async () => {
      secondSave = result.current.handleSave();
      await Promise.resolve();
    });

    expect(vi.mocked(writeWorkspaceFile)).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave?.();
      await firstSave;
      await secondSave;
    });

    await expect(firstSave).resolves.toBe(true);
    await expect(secondSave).resolves.toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(vi.mocked(pushErrorToast)).not.toHaveBeenCalled();
    expect(vi.mocked(readExternalSpecFile)).not.toHaveBeenCalled();
    expect(vi.mocked(readExternalAbsoluteFile)).not.toHaveBeenCalled();
    expect(vi.mocked(writeExternalSpecFile)).not.toHaveBeenCalled();
  });

  it("saves latest content when a draft is flushed immediately before save", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });
    vi.mocked(writeWorkspaceFile).mockResolvedValue();

    const { result } = renderHook(
      (props: HookProps) => useFileDocumentState(props),
      {
        initialProps: {
          workspaceId: "ws-immediate-save",
          customSpecRoot: null,
          workspaceRelativeFilePath: "src/value.ts",
          fileReadTarget: makeWorkspaceTarget("src/value.ts"),
          skipTextRead: false,
          externalAbsoluteReadOnlyMessage: "read only",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.content).toBe("const value = 1;");
    });

    let saved = false;
    await act(async () => {
      result.current.setContent("const value = 2;");
      saved = await result.current.handleSave();
    });

    expect(saved).toBe(true);
    expect(writeWorkspaceFile).toHaveBeenCalledWith(
      "ws-immediate-save",
      "src/value.ts",
      "const value = 2;",
    );
  });

  it("keeps edits made during an in-flight save dirty", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });
    let resolveSave!: () => void;
    vi.mocked(writeWorkspaceFile).mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result } = renderHook(
      (props: HookProps) => useFileDocumentState(props),
      {
        initialProps: {
          workspaceId: "ws-edit-during-save",
          customSpecRoot: null,
          workspaceRelativeFilePath: "src/value.ts",
          fileReadTarget: makeWorkspaceTarget("src/value.ts"),
          skipTextRead: false,
          externalAbsoluteReadOnlyMessage: "read only",
        },
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setContent("const value = 2;"));

    let savePromise!: Promise<boolean>;
    act(() => {
      savePromise = result.current.handleSave();
    });
    act(() => result.current.setContent("const value = 3;"));
    await act(async () => {
      resolveSave();
      await savePromise;
    });

    await expect(savePromise).resolves.toBe(false);
    expect(result.current.content).toBe("const value = 3;");
    expect(result.current.savedContentRef.current).toBe("const value = 2;");
    expect(result.current.isDirty).toBe(true);
  });

  it("refreshes clean cached content from disk when reopening the same file", async () => {
    let diskContent = "const value = 1;";
    vi.mocked(readWorkspaceFile).mockImplementation(async () => ({
      content: diskContent,
      truncated: false,
    }));

    const initialProps: HookProps = {
      workspaceId: "ws-clean-cache-refresh",
      customSpecRoot: null,
      workspaceRelativeFilePath: "src/value.ts",
      fileReadTarget: makeWorkspaceTarget("src/value.ts"),
      skipTextRead: false,
      externalAbsoluteReadOnlyMessage: "read only",
    };

    const firstRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });

    await waitFor(() => {
      expect(firstRender.result.current.isLoading).toBe(false);
      expect(firstRender.result.current.content).toBe("const value = 1;");
    });

    firstRender.unmount();
    diskContent = "const value = 2;";

    const secondRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });

    expect(secondRender.result.current.content).toBe("const value = 1;");

    await waitFor(() => {
      expect(secondRender.result.current.isLoading).toBe(false);
      expect(secondRender.result.current.content).toBe("const value = 2;");
    });
    expect(readWorkspaceFile).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite edits made while a clean cached file refreshes from disk", async () => {
    let resolveRefresh!: (value: { content: string; truncated: boolean }) => void;
    vi.mocked(readWorkspaceFile)
      .mockResolvedValueOnce({ content: "const value = 1;", truncated: false })
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
      );
    const initialProps: HookProps = {
      workspaceId: "ws-clean-cache-edit-race",
      customSpecRoot: null,
      workspaceRelativeFilePath: "src/value.ts",
      fileReadTarget: makeWorkspaceTarget("src/value.ts"),
      skipTextRead: false,
      externalAbsoluteReadOnlyMessage: "read only",
    };
    const firstRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });
    await waitFor(() => expect(firstRender.result.current.isLoading).toBe(false));
    firstRender.unmount();

    const secondRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });
    expect(secondRender.result.current.content).toBe("const value = 1;");
    act(() => {
      secondRender.result.current.setContent("const localDraft = 2;");
    });
    await act(async () => {
      resolveRefresh({ content: "const disk = 3;", truncated: false });
      await Promise.resolve();
    });

    expect(secondRender.result.current.content).toBe("const localDraft = 2;");
    expect(secondRender.result.current.isDirty).toBe(true);
  });

  it("keeps dirty cached drafts instead of overwriting them with disk content", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });

    const initialProps: HookProps = {
      workspaceId: "ws-dirty-cache-refresh",
      customSpecRoot: null,
      workspaceRelativeFilePath: "src/value.ts",
      fileReadTarget: makeWorkspaceTarget("src/value.ts"),
      skipTextRead: false,
      externalAbsoluteReadOnlyMessage: "read only",
    };

    const firstRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });

    await waitFor(() => {
      expect(firstRender.result.current.isLoading).toBe(false);
      expect(firstRender.result.current.content).toBe("const value = 1;");
    });

    act(() => {
      firstRender.result.current.setContent("const draft = 2;");
    });
    firstRender.unmount();
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const disk = 3;",
      truncated: false,
    });

    const secondRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });

    await waitFor(() => {
      expect(secondRender.result.current.isLoading).toBe(false);
      expect(secondRender.result.current.content).toBe("const draft = 2;");
      expect(secondRender.result.current.isDirty).toBe(true);
    });
    expect(readWorkspaceFile).toHaveBeenCalledTimes(1);
  });

  it("discards a dirty cached draft and reopens from the saved source", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });
    const initialProps: HookProps = {
      workspaceId: "ws-discard-cache",
      customSpecRoot: null,
      workspaceRelativeFilePath: "src/value.ts",
      fileReadTarget: makeWorkspaceTarget("src/value.ts"),
      skipTextRead: false,
      externalAbsoluteReadOnlyMessage: "read only",
    };
    const firstRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });

    await waitFor(() => expect(firstRender.result.current.isLoading).toBe(false));
    act(() => {
      firstRender.result.current.setContent("const draft = 2;");
      firstRender.result.current.handleDiscard();
    });
    await waitFor(() => {
      expect(firstRender.result.current.content).toBe("const value = 1;");
      expect(firstRender.result.current.isDirty).toBe(false);
    });
    firstRender.unmount();

    const secondRender = renderHook((props: HookProps) => useFileDocumentState(props), {
      initialProps,
    });
    await waitFor(() => {
      expect(secondRender.result.current.content).toBe("const value = 1;");
      expect(secondRender.result.current.isDirty).toBe(false);
    });
  });
});
