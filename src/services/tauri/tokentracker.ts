import { invoke } from "@tauri-apps/api/core";
import type { TtCliStatus, TtInstallResult, TtServerStatus } from "../../types";

export async function ttDetectCli(): Promise<TtCliStatus> {
  return invoke("tt_detect_cli");
}

export async function ttServerStatus(): Promise<TtServerStatus> {
  return invoke("tt_server_status");
}

export async function ttInstallCli(): Promise<TtInstallResult> {
  return invoke("tt_install_cli");
}

export async function ttEnsureServer(): Promise<TtServerStatus> {
  return invoke("tt_ensure_server");
}

export async function ttProxyRequest(
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: string,
): Promise<unknown> {
  return invoke("tt_proxy", {
    method,
    path,
    headers: headers ?? null,
    body: body ?? null,
  });
}
