import { resolveEnabledBuiltInAgent } from "../../../services/tauri";
import type { SelectedAgentOption } from "../../../types";

export type SelectedAgentSendResolution = {
  agent: SelectedAgentOption | null;
  error: Error | null;
};

export async function resolveSelectedAgentForSend(
  selectedAgent: SelectedAgentOption | null | undefined,
): Promise<SelectedAgentSendResolution> {
  if (!selectedAgent || selectedAgent.source !== "builtIn") {
    return {
      agent: selectedAgent ?? null,
      error: null,
    };
  }

  try {
    const resolved = await resolveEnabledBuiltInAgent(selectedAgent.id);
    if (resolved.id !== selectedAgent.id || !resolved.prompt.trim()) {
      throw new Error("Built-in agent prompt response is invalid");
    }
    return {
      agent: {
        ...selectedAgent,
        prompt: resolved.prompt,
        sourceRevision: resolved.sourceRevision,
        promptHash: resolved.promptHash,
      },
      error: null,
    };
  } catch (error) {
    return {
      agent: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
