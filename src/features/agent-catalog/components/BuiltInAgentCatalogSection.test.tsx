// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBuiltInAgentPrompt } from "../../../services/tauri";
import { useBuiltInAgentCatalog } from "../hooks/useBuiltInAgentCatalog";
import { BuiltInAgentCatalogSection } from "./BuiltInAgentCatalogSection";

vi.mock("../../../services/tauri", () => ({
  getBuiltInAgentPrompt: vi.fn(),
}));

vi.mock("../hooks/useBuiltInAgentCatalog", () => ({
  useBuiltInAgentCatalog: vi.fn(),
}));

const getBuiltInAgentPromptMock = vi.mocked(getBuiltInAgentPrompt);
const useBuiltInAgentCatalogMock = vi.mocked(useBuiltInAgentCatalog);
const setAgentEnabled = vi.fn();
const setDivisionEnabled = vi.fn();

const catalog = {
  providerId: "agency-agents",
  displayName: "Agency Agents",
  sourceUrl: "https://github.com/msitarzewski/agency-agents",
  sourceRevision: "459dce837db3bdfdc4763d3fefd1fd854e73c8f1",
  license: "MIT",
  divisions: [
    {
      id: "engineering",
      order: 1,
      count: 1,
      enabledCount: 1,
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
      sourceRevision: "459dce837db3bdfdc4763d3fefd1fd854e73c8f1",
      promptHash: "hash",
      enabled: true,
    },
  ],
};

describe("BuiltInAgentCatalogSection", () => {
  beforeEach(() => {
    setAgentEnabled.mockReset();
    setDivisionEnabled.mockReset();
    getBuiltInAgentPromptMock.mockReset();
    useBuiltInAgentCatalogMock.mockReturnValue({
      catalog,
      loading: false,
      pendingKey: null,
      error: null,
      loadCatalog: vi.fn(),
      setAgentEnabled,
      setDivisionEnabled,
    });
  });

  it("renders localized groups and exposes explicit enable controls", () => {
    render(
      <BuiltInAgentCatalogSection
        active
        onUpdateAppSettings={vi.fn()}
        onCopyAgent={vi.fn()}
      />,
    );

    expect(screen.getAllByText("工程研发").length).toBeGreaterThan(0);
    expect(screen.getByText("AI 工程师")).toBeTruthy();
    expect(screen.getByText("构建可靠的 AI 系统")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://github.com/msitarzewski/agency-agents",
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(setAgentEnabled).toHaveBeenCalledWith(
      "agency-agents:engineering/engineering-ai-engineer",
      false,
    );
  });

  it("copies a bundled prompt into an independent custom-agent draft", async () => {
    getBuiltInAgentPromptMock.mockResolvedValue({
      id: "agency-agents:engineering/engineering-ai-engineer",
      providerId: "agency-agents",
      sourceRevision: "revision",
      promptHash: "hash",
      prompt: "完整内置提示词",
    });
    const onCopyAgent = vi.fn();
    render(
      <BuiltInAgentCatalogSection
        active
        onUpdateAppSettings={vi.fn()}
        onCopyAgent={onCopyAgent}
      />,
    );

    fireEvent.click(screen.getByTitle("settings.agent.builtIn.copy"));

    await waitFor(() => {
      expect(onCopyAgent).toHaveBeenCalledWith({
        name: "AI 工程师",
        prompt: "完整内置提示词",
      });
    });
  });
});
