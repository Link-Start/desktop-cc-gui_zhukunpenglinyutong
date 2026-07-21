import { invoke } from "@tauri-apps/api/core";

export async function saveMermaidPngFile(
  path: string,
  pngBytes: number[],
): Promise<void> {
  await invoke("save_mermaid_png", { path, pngBytes });
}
