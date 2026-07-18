import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEnabledBuiltInAgent } from "../../../services/tauri";
import { resolveSelectedAgentForSend } from "./resolveSelectedAgentForSend";

vi.mock("../../../services/tauri", () => ({
  resolveEnabledBuiltInAgent: vi.fn(),
}));

const resolveEnabledBuiltInAgentMock = vi.mocked(resolveEnabledBuiltInAgent);

describe("resolveSelectedAgentForSend", () => {
  beforeEach(() => {
    resolveEnabledBuiltInAgentMock.mockReset();
  });

  it("keeps custom agents local and does not call the built-in resolver", async () => {
    const customAgent = {
      id: "custom:reviewer",
      name: "Reviewer",
      prompt: "Review carefully",
      source: "custom" as const,
    };

    await expect(resolveSelectedAgentForSend(customAgent)).resolves.toEqual({
      agent: customAgent,
      error: null,
    });
    expect(resolveEnabledBuiltInAgentMock).not.toHaveBeenCalled();
  });

  it("loads the prompt only when an enabled built-in agent is sent", async () => {
    resolveEnabledBuiltInAgentMock.mockResolvedValue({
      id: "agency-agents:engineering/engineering-ai-engineer",
      providerId: "agency-agents",
      sourceRevision: "revision-2",
      promptHash: "hash-2",
      prompt: "Resolved prompt",
    });

    await expect(
      resolveSelectedAgentForSend({
        id: "agency-agents:engineering/engineering-ai-engineer",
        name: "AI Engineer",
        prompt: null,
        source: "builtIn",
        sourceRevision: "revision-1",
        promptHash: "hash-1",
      }),
    ).resolves.toEqual({
      agent: {
        id: "agency-agents:engineering/engineering-ai-engineer",
        name: "AI Engineer",
        prompt: "Resolved prompt",
        source: "builtIn",
        sourceRevision: "revision-2",
        promptHash: "hash-2",
      },
      error: null,
    });
  });

  it("fails closed when the built-in agent was disabled after selection", async () => {
    resolveEnabledBuiltInAgentMock.mockRejectedValue(
      new Error("built-in agent is disabled"),
    );

    const result = await resolveSelectedAgentForSend({
      id: "agency-agents:design/design-ui-designer",
      name: "UI Designer",
      source: "builtIn",
    });

    expect(result.agent).toBeNull();
    expect(result.error?.message).toContain("disabled");
  });
});
