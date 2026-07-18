import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAgentConfigs, listBuiltInAgents } from "../../../../../services/tauri";
import {
  agentProvider,
  resetAgentsState,
} from "./agentProvider";

vi.mock("../../../../../services/tauri", () => ({
  listAgentConfigs: vi.fn(),
  listBuiltInAgents: vi.fn(),
}));

const listAgentConfigsMock = vi.mocked(listAgentConfigs);
const listBuiltInAgentsMock = vi.mocked(listBuiltInAgents);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function catalog(enabled: boolean) {
  return {
    providerId: "agency-agents",
    displayName: "Agency Agents",
    sourceUrl: "https://github.com/msitarzewski/agency-agents",
    sourceRevision: "revision",
    license: "MIT",
    divisions: [
      {
        id: "engineering",
        order: 1,
        count: 1,
        enabledCount: enabled ? 1 : 0,
        icon: "code",
        color: "#2563eb",
        label: "工程研发",
        labelEn: "Engineering",
      },
    ],
    agents: [
      {
        id: "agency-agents:engineering/engineering-ai-engineer",
        providerId: "agency-agents",
        divisionId: "engineering",
        name: "AI 工程师",
        nameEn: "AI Engineer",
        description: "构建可靠的 AI 系统",
        descriptionEn: "Build reliable AI systems",
        color: "#2563eb",
        emoji: "🤖",
        sourcePath: "engineering/engineering-ai-engineer.md",
        sourceRevision: "revision",
        promptHash: "hash",
        enabled,
      },
    ],
  };
}

describe("agentProvider built-in visibility", () => {
  beforeEach(() => {
    resetAgentsState();
    listAgentConfigsMock.mockReset();
    listBuiltInAgentsMock.mockReset();
    listAgentConfigsMock.mockResolvedValue([]);
  });

  it("does not expose disabled built-in agents in the # picker", async () => {
    listBuiltInAgentsMock.mockResolvedValue(catalog(false));

    const items = await agentProvider("", new AbortController().signal);

    expect(
      items.some((item) => item.id.startsWith("agency-agents:")),
    ).toBe(false);
  });

  it("does not reveal a disabled built-in agent through search", async () => {
    listBuiltInAgentsMock.mockResolvedValue(catalog(false));

    const items = await agentProvider(
      "AI Engineer",
      new AbortController().signal,
    );

    expect(
      items.some((item) => item.id.startsWith("agency-agents:")),
    ).toBe(false);
  });

  it("shows enabled built-in agents under their localized group", async () => {
    listBuiltInAgentsMock.mockResolvedValue(catalog(true));

    const items = await agentProvider("", new AbortController().signal);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "__section__:division:engineering",
          name: "工程研发",
          icon: "codicon-symbol-namespace",
          sectionCount: 1,
          itemKind: "sectionHeader",
        }),
        expect.objectContaining({
          id: "agency-agents:engineering/engineering-ai-engineer",
          name: "AI 工程师",
          source: "builtIn",
          divisionLabel: "工程研发",
        }),
      ]),
    );
  });

  it("does not let an invalidated request repopulate stale built-in agents", async () => {
    const staleRequest = deferred<ReturnType<typeof catalog>>();
    const currentRequest = deferred<ReturnType<typeof catalog>>();
    listBuiltInAgentsMock
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    const staleLoad = agentProvider("", new AbortController().signal);
    expect(listBuiltInAgentsMock).toHaveBeenCalledTimes(1);

    resetAgentsState();
    const currentLoad = agentProvider("", new AbortController().signal);
    expect(listBuiltInAgentsMock).toHaveBeenCalledTimes(2);

    currentRequest.resolve(catalog(false));
    await currentLoad;
    staleRequest.resolve(catalog(true));
    await staleLoad;

    const items = await agentProvider("", new AbortController().signal);
    expect(
      items.some((item) => item.id.startsWith("agency-agents:")),
    ).toBe(false);
  });
});
