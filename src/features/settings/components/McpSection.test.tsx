// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { McpSection } from "./McpSection";

type SelectMockContextValue = {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  onValueChange: ((value: string) => void) | undefined;
};

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const SelectContext = React.createContext<SelectMockContextValue | null>(null);

  const useSelectContext = () => {
    const context = React.useContext(SelectContext);
    if (!context) {
      throw new Error("Select mock components must be rendered inside Select");
    }
    return context;
  };

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) {
    const [open, setOpen] = React.useState(false);

    return (
      <SelectContext.Provider value={{ value, open, setOpen, onValueChange }}>
        {children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({
    children,
    onClick,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) {
    const context = useSelectContext();

    return (
      <button
        aria-expanded={context.open}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            context.setOpen(!context.open);
          }
        }}
        role="combobox"
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  }

  function SelectValue() {
    const context = useSelectContext();
    return <span>{context.value}</span>;
  }

  function SelectContent({
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement>) {
    const context = useSelectContext();
    if (!context.open) {
      return null;
    }

    return (
      <div role="listbox" {...props}>
        {children}
      </div>
    );
  }

  function SelectItem({
    value,
    children,
    onClick,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { value: string }) {
    const context = useSelectContext();

    return (
      <div
        aria-selected={context.value === value}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            context.onValueChange?.(value);
            context.setOpen(false);
          }
        }}
        role="option"
        {...props}
      >
        {children}
      </div>
    );
  }

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("../../../services/tauri", () => ({
  detectEngines: vi.fn(),
  listGlobalMcpServers: vi.fn(),
  listMcpServerStatus: vi.fn(),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: vi.fn(),
}));

import {
  detectEngines,
  listGlobalMcpServers,
  listMcpServerStatus,
} from "../../../services/tauri";
import { isWindowsPlatform } from "../../../utils/platform";

const workspace: WorkspaceInfo = {
  id: "ws-mcp",
  name: "Workspace MCP",
  path: "/tmp/ws-mcp",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("McpSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(isWindowsPlatform).mockReturnValue(false);
    vi.mocked(detectEngines).mockResolvedValue([
      {
        engineType: "claude",
        installed: true,
        version: "1.2.0",
        binPath: "/usr/local/bin/claude",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "codex",
        installed: true,
        version: "2.0.0",
        binPath: "/usr/local/bin/codex",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "gemini",
        installed: false,
        version: null,
        binPath: null,
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: false,
          sessionContinuation: true,
        },
        models: [],
        error: "not installed",
      },
      {
        engineType: "opencode",
        installed: true,
        version: "0.9.0",
        binPath: "/usr/local/bin/opencode",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: false,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
    ]);
    vi.mocked(listGlobalMcpServers).mockResolvedValue([
      {
        name: "filesystem",
        enabled: true,
        transport: "stdio",
        command: "npx",
        url: null,
        argsCount: 2,
        source: "claude_json",
      },
      {
        name: "github",
        enabled: true,
        transport: "stdio",
        command: "uvx",
        url: null,
        argsCount: 3,
        source: "ccgui_config",
      },
    ]);
    vi.mocked(listMcpServerStatus).mockResolvedValue({
      result: {
        data: [
          {
            name: "github",
            authStatus: { status: "connected" },
            tools: {
              mcp__github__search_repos: {},
            },
            resources: [],
            resourceTemplates: [],
          },
        ],
      },
    });
  });

  it("renders engine-specific rules and opens the engine select menu", async () => {
    const { unmount } = render(
      <McpSection activeWorkspace={workspace} activeEngine="codex" />,
    );

    await screen.findByText("By engine");
    await screen.findByText("search_repos");

    expect(screen.getByText("Detailed status and rules")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Select engine to inspect" })).toBeTruthy();
    expect(screen.getAllByText("Runtime rules").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Config-defined servers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("github").length).toBeGreaterThan(0);
    expect(screen.getByText("search_repos")).toBeTruthy();
    expect(screen.getByText("2 / 2 installed")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Select engine to inspect" }));
    expect(await screen.findByRole("option", { name: "Claude Code" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Codex" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Gemini" })).toBeNull();
    expect(screen.queryByRole("option", { name: "OpenCode" })).toBeNull();
    expect(screen.queryByText("Gemini")).toBeNull();
    expect(screen.queryByText("OpenCode")).toBeNull();

    unmount();
  });

  it("keeps overview inventory aligned with the supported engine selection", async () => {
    render(<McpSection activeWorkspace={workspace} activeEngine="codex" />);

    await screen.findByText("search_repos");

    const selectedOverviewCard = screen
      .getByText("Selected engine")
      .closest(".settings-mcp-overview-card");
    expect(selectedOverviewCard).toBeTruthy();
    expect(within(selectedOverviewCard as HTMLElement).getByText("Codex")).toBeTruthy();
    expect(screen.getAllByText("1 servers · 1 tools").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("combobox", { name: "Select engine to inspect" }));
    fireEvent.click(await screen.findByRole("option", { name: "Claude Code" }));

    await waitFor(() => {
      expect(screen.getAllByText("1 servers · 0 tools").length).toBeGreaterThan(0);
      const switchedOverviewCard = screen
        .getByText("Selected engine")
        .closest(".settings-mcp-overview-card");
      expect(switchedOverviewCard).toBeTruthy();
      expect(within(switchedOverviewCard as HTMLElement).getByText("Claude Code")).toBeTruthy();
      expect(screen.getAllByText("filesystem").length).toBeGreaterThan(0);
      expect(screen.queryByText("search_repos")).toBeNull();
    });
  });

  it("strips Codex runtime tool prefixes case-insensitively", async () => {
    vi.mocked(listMcpServerStatus).mockResolvedValue({
      result: {
        data: [
          {
            name: "GitHub",
            authStatus: { status: "connected" },
            tools: {
              mcp__github__search_repos: {},
            },
            resources: [],
            resourceTemplates: [],
          },
        ],
      },
    });

    render(<McpSection activeWorkspace={workspace} activeEngine="codex" />);

    await screen.findByText("search_repos");
    expect(screen.queryByText("mcp__github__search_repos")).toBeNull();
  });

  it("shows Windows-style config paths when backend paths are Windows-style", async () => {
    vi.mocked(isWindowsPlatform).mockReturnValue(false);

    render(
      <McpSection
        activeWorkspace={{ ...workspace, path: "C:\\workspace\\ws-mcp" }}
        activeEngine="codex"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).toBeNull();
    });

    expect(
      screen.getAllByText("%USERPROFILE%\\.ccgui\\config.json · %USERPROFILE%\\.codex\\config.toml").length,
    ).toBeGreaterThan(0);
  });
});
