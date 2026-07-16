import { invoke } from "@tauri-apps/api/core";
import type { EngineType } from "../../types";
import { engineSendMessageSync } from "./appServer";

export type CommitMessageLanguage = "zh" | "en";
export type CommitMessageEngine = EngineType;
export type CommitMessageRepositorySelection = {
  repositoryRoot: string;
  selectedPaths: string[];
};

export async function getCommitMessagePrompt(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  selectedPaths?: string[],
  repositorySelections?: CommitMessageRepositorySelection[],
): Promise<string> {
  return invoke("get_commit_message_prompt", {
    workspaceId,
    language,
    selectedPaths,
    ...(repositorySelections ? { repositorySelections } : {}),
  });
}

export async function generateCommitMessage(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  selectedPaths?: string[],
  repositorySelections?: CommitMessageRepositorySelection[],
): Promise<string> {
  return invoke("generate_commit_message", {
    workspaceId,
    language,
    selectedPaths,
    ...(repositorySelections ? { repositorySelections } : {}),
  });
}

export async function generateCommitMessageWithEngine(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  engine: CommitMessageEngine = "codex",
  selectedPaths?: string[],
  repositorySelections?: CommitMessageRepositorySelection[],
): Promise<string> {
  if (engine === "codex") {
    return generateCommitMessage(
      workspaceId,
      language,
      selectedPaths,
      repositorySelections,
    );
  }
  const prompt = await getCommitMessagePrompt(
    workspaceId,
    language,
    selectedPaths,
    repositorySelections,
  );
  const response = await engineSendMessageSync(workspaceId, {
    text: prompt,
    engine,
    autoSession: {
      sessionPurpose: "commit-message",
      visibility: "hidden",
      ownerFeature: "git",
      autoArchive: true,
      createdBy: "system",
    },
  });
  return response.text;
}
