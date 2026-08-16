import { useCallback } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { ensureWorkspacePathDir } from "../../services/tauri/workspaceRuntime";
import { isWebServiceRuntime } from "../../services/tauri/runtimeMode";
import {
  getDefaultWorkspaceCandidatePaths,
  isDefaultWorkspacePath,
} from "../../features/workspaces/utils/defaultWorkspace";
import type {
  MessageSendOptions,
  WorkspaceInfo,
} from "../../types";
import type { UseAppShellSectionsContext } from "./useAppShellSectionsTypes";

export function useAppShellComposerSendSection(
  ctx: UseAppShellSectionsContext,
) {
  const {
    workspaces,
    setAppMode,
    activeEngine,
    selectedAgent,
    selectedAgentRef,
    activeWorkspaceId,
    normalizePath,
    addWorkspaceFromPath,
    alertError,
    workspacesById,
    exitDiffView,
    connectWorkspace,
    startThreadForWorkspace,
    persistComposerSelectionForThread,
    setActiveEngine,
    setHomeOpen,
    setCenterMode,
    selectWorkspace,
    setActiveThreadId,
    sendUserMessageToThread,
    handleComposerSend,
    isPullRequestComposer,
    resetPullRequestSelection,
    setWorkspaceHomeWorkspaceId,
    handleComposerQueue,
  } = ctx;
  const typedWorkspaces = workspaces as WorkspaceInfo[];

  const resolveDefaultHomeComposerWorkspace =
    useCallback(async (): Promise<WorkspaceInfo | null> => {
      if (isWebServiceRuntime()) {
        const existingWorkspace =
          typedWorkspaces.find((entry) => isDefaultWorkspacePath(entry.path)) ??
          typedWorkspaces.find((entry) => entry.kind === "main") ??
          typedWorkspaces[0] ??
          null;
        if (existingWorkspace) {
          return existingWorkspace;
        }

        try {
          const resolvedHome = normalizePath(await homeDir());
          if (!resolvedHome) {
            throw new Error("Unable to resolve default workspace path.");
          }
          let createdWorkspacePath: string | null = null;
          let lastError: unknown = null;
          for (const candidatePath of getDefaultWorkspaceCandidatePaths(
            resolvedHome,
          )) {
            try {
              await ensureWorkspacePathDir(candidatePath);
              createdWorkspacePath = candidatePath;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!createdWorkspacePath) {
            throw (
              lastError ?? new Error("Failed to create default workspace path.")
            );
          }
          const normalizedDefaultPath = normalizePath(createdWorkspacePath);
          return (
            typedWorkspaces.find(
              (entry) =>
                normalizePath(entry.path) === normalizedDefaultPath,
            ) ?? (await addWorkspaceFromPath(createdWorkspacePath))
          );
        } catch (error) {
          alertError(error);
          return null;
        }
      }

      try {
        const resolvedHome = normalizePath(await homeDir());
        const defaultWorkspacePath = `${resolvedHome}/.ccgui/workspace`;
        await ensureWorkspacePathDir(defaultWorkspacePath);
        const normalizedDefaultPath = normalizePath(defaultWorkspacePath);
        return (
          typedWorkspaces.find(
            (entry) => normalizePath(entry.path) === normalizedDefaultPath,
          ) ?? (await addWorkspaceFromPath(defaultWorkspacePath))
        );
      } catch (error) {
        alertError(error);
        return null;
      }
    }, [
      addWorkspaceFromPath,
      alertError,
      normalizePath,
      typedWorkspaces,
    ]);

  const mergeSelectedAgentOption = useCallback(
    (options?: MessageSendOptions): MessageSendOptions | undefined => {
      if (activeEngine === "opencode") {
        return options;
      }
      const selectedAgentForSend =
        selectedAgentRef?.current ?? selectedAgent ?? null;
      const merged: MessageSendOptions = {
        ...(options ?? {}),
        selectedAgent: selectedAgentForSend
          ? {
              id: selectedAgentForSend.id,
              name: selectedAgentForSend.name,
              prompt: selectedAgentForSend.prompt ?? null,
              icon: selectedAgentForSend.icon ?? null,
            }
          : null,
      };
      return merged;
    },
    [activeEngine, selectedAgent, selectedAgentRef],
  );

  const handleComposerSendWithHomeTarget = useCallback(
    async (text: string, images: string[], options?: MessageSendOptions) => {
      const trimmedOriginalText = text.trim();
      const createSessionTarget = options?.createSessionTarget ?? null;

      if (createSessionTarget && !isPullRequestComposer) {
        const workspace =
          (activeWorkspaceId
            ? workspacesById.get(activeWorkspaceId) ?? null
            : null) ?? (await resolveDefaultHomeComposerWorkspace());
        if (!workspace) {
          return;
        }

        const {
          createSessionTarget: _consumedCreateSessionTarget,
          ...turnOptions
        } = options ?? {};
        const providerProfile = createSessionTarget.providerProfileId
          ? {
              id: createSessionTarget.providerProfileId,
              name:
                createSessionTarget.providerProfileName ??
                createSessionTarget.providerProfileId,
              source: createSessionTarget.providerProfileSource,
            }
          : null;

        exitDiffView();
        resetPullRequestSelection();
        setHomeOpen(false);
        setWorkspaceHomeWorkspaceId(null);
        setAppMode("chat");
        setCenterMode("chat");
        selectWorkspace(workspace.id);
        if (!workspace.connected) {
          await connectWorkspace(workspace);
        }
        await setActiveEngine(createSessionTarget.engine);
        const threadId = await startThreadForWorkspace(workspace.id, {
          engine: createSessionTarget.engine,
          activate: true,
          providerProfileId: createSessionTarget.providerProfileId,
          providerProfile,
        });
        if (!threadId) {
          return;
        }
        persistComposerSelectionForThread(workspace.id, threadId, {
          modelId: createSessionTarget.modelCatalogEntryId,
          effort: createSessionTarget.effort,
        });
        setActiveThreadId(threadId, workspace.id);

        if (trimmedOriginalText.length > 0 || images.length > 0) {
          await sendUserMessageToThread(
            workspace,
            threadId,
            trimmedOriginalText,
            images,
            mergeSelectedAgentOption({
              ...turnOptions,
              // DSH host RPC parses `provider/model`; runtime-only names drop
              // the provider and silently keep the host default.
              model:
                createSessionTarget.engine === "dsh"
                  ? createSessionTarget.modelCatalogEntryId
                  : createSessionTarget.model,
              effort: createSessionTarget.effort,
            }),
          );
        }
        return;
      }

      // HomeChat send: no active workspace yet. Select or create one, then
      // create a thread and jump to normal chat view before sending.
      if (!activeWorkspaceId && !isPullRequestComposer) {
        const workspace = await resolveDefaultHomeComposerWorkspace();
        if (!workspace) {
          return;
        }
        exitDiffView();
        resetPullRequestSelection();
        setWorkspaceHomeWorkspaceId(null);
        setAppMode("chat");
        setCenterMode("chat");
        selectWorkspace(workspace.id);
        if (!workspace.connected) {
          await connectWorkspace(workspace);
        }
        const threadId = await startThreadForWorkspace(workspace.id, {
          engine: activeEngine,
          activate: true,
        });
        if (!threadId) {
          return;
        }
        setActiveThreadId(threadId, workspace.id);
        if (trimmedOriginalText.length > 0 || images.length > 0) {
          await sendUserMessageToThread(
            workspace,
            threadId,
            trimmedOriginalText,
            images,
            mergeSelectedAgentOption(options),
          );
        }
        return;
      }

      await handleComposerSend(
        trimmedOriginalText,
        images,
        mergeSelectedAgentOption(options),
      );
    },
    [
      handleComposerSend,
      mergeSelectedAgentOption,
      activeWorkspaceId,
      resolveDefaultHomeComposerWorkspace,
      workspacesById,
      exitDiffView,
      resetPullRequestSelection,
      selectWorkspace,
      setAppMode,
      setActiveThreadId,
      setCenterMode,
      setHomeOpen,
      setWorkspaceHomeWorkspaceId,
      connectWorkspace,
      setActiveEngine,
      startThreadForWorkspace,
      persistComposerSelectionForThread,
      sendUserMessageToThread,
      isPullRequestComposer,
      activeEngine,
    ],
  );

  const handleComposerSendWithEditorFallback = useCallback(
    async (text: string, images: string[], options?: MessageSendOptions) => {
      await handleComposerSendWithHomeTarget(text, images, options);
    },
    [handleComposerSendWithHomeTarget],
  );

  const handleComposerQueueWithEditorFallback = useCallback(
    async (text: string, images: string[], options?: MessageSendOptions) => {
      await handleComposerQueue(
        text,
        images,
        mergeSelectedAgentOption(options),
      );
    },
    [handleComposerQueue, mergeSelectedAgentOption],
  );

  return {
    handleComposerSendWithEditorFallback,
    handleComposerQueueWithEditorFallback,
  };
}
