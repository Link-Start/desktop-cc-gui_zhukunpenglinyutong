import type { ToolItem } from "./workspaceSessionActivityTypes";

export function getRuntimeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getToolTitle(item: ToolItem): string {
  return getRuntimeString((item as { title?: unknown }).title);
}

export function getToolDetail(item: ToolItem): string {
  return getRuntimeString((item as { detail?: unknown }).detail);
}

export function getToolType(item: ToolItem): string {
  return getRuntimeString((item as { toolType?: unknown }).toolType);
}

export function getToolOutput(item: ToolItem): string | undefined {
  const output = getRuntimeString((item as { output?: unknown }).output);
  return output.length > 0 ? output : undefined;
}
