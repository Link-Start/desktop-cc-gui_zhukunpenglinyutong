import { invoke } from "@tauri-apps/api/core";

export type TextFileResponse = {
  exists: boolean;
  content: string;
  truncated: boolean;
};

export type GlobalAgentsResponse = TextFileResponse;
export type GlobalCodexConfigResponse = TextFileResponse;
export type GlobalCodexAuthResponse = TextFileResponse;
export type AgentMdResponse = TextFileResponse;
export type ClaudeMdResponse = TextFileResponse;

type FileScope = "workspace" | "global";
type FileKind = "agents" | "claude" | "config" | "auth";

async function fileRead(scope: FileScope, kind: FileKind, workspaceId?: string): Promise<TextFileResponse> {
  return invoke<TextFileResponse>("file_read", { scope, kind, workspaceId });
}

async function fileWrite(scope: FileScope, kind: FileKind, content: string, workspaceId?: string): Promise<void> {
  return invoke("file_write", { scope, kind, workspaceId, content });
}

export async function readGlobalAgentsMd(): Promise<GlobalAgentsResponse> {
  return fileRead("global", "agents");
}

export async function writeGlobalAgentsMd(content: string): Promise<void> {
  return fileWrite("global", "agents", content);
}

export async function readGlobalCodexConfigToml(): Promise<GlobalCodexConfigResponse> {
  return fileRead("global", "config");
}

export async function writeGlobalCodexConfigToml(content: string): Promise<void> {
  return fileWrite("global", "config", content);
}

export async function readGlobalCodexAuthJson(): Promise<GlobalCodexAuthResponse> {
  return fileRead("global", "auth");
}

export async function writeGlobalCodexAuthJson(content: string): Promise<void> {
  return fileWrite("global", "auth", content);
}

export async function readAgentMd(workspaceId: string): Promise<AgentMdResponse> {
  return fileRead("workspace", "agents", workspaceId);
}

export async function writeAgentMd(workspaceId: string, content: string): Promise<void> {
  return fileWrite("workspace", "agents", content, workspaceId);
}

export async function readClaudeMd(workspaceId: string): Promise<ClaudeMdResponse> {
  return fileRead("workspace", "claude", workspaceId);
}

export async function writeClaudeMd(workspaceId: string, content: string): Promise<void> {
  return fileWrite("workspace", "claude", content, workspaceId);
}
