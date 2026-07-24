import { useCallback, useEffect, useRef, useState } from "react";

import { ttDetectCli, ttEnsureServer, ttInstallCli } from "@/services/tauri";

/**
 * TokenTracker 本地服务状态机：
 *
 *   checking ─┬─ CLI 未安装 ──────────────→ guide
 *             └─ CLI 已安装 → starting ─┬─ ensure 成功 ─→ ready
 *                                       ├─ ensure 报 not_installed → guide
 *                                       └─ ensure 其他失败 ────────→ error
 *
 *   guide 态 recheck() → 重新 checking；error 态 retry() → 重新 starting。
 *   guide 态 install() → installing → detect/ensure。
 *
 * 只在组件挂载期间做一次性 detect + ensure，不做任何轮询；所有 state 都留在
 * 本 hook 内，不进入 app-shell 根链 store。
 */
export type TokenTrackerServerState =
  | { status: "checking" }
  | { status: "guide" }
  | { status: "installing" }
  | { status: "starting" }
  | { status: "ready"; port: number }
  | { status: "error"; message: string };

const CLI_NOT_INSTALLED_ERROR = "tokentracker_cli_not_installed";

/** 浏览器 dev 预览（vite + /tt-dev proxy）下没有 Tauri IPC，跳过 detect/ensure 直接就绪。 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useTokenTrackerServer() {
  const [state, setState] = useState<TokenTrackerServerState>({
    status: "checking",
  });
  // generation 令牌：卸载 / 新一轮触发后，丢弃在途异步结果（含 StrictMode 双跑）。
  const generationRef = useRef(0);

  const runEnsure = useCallback(async (generation: number) => {
    setState({ status: "starting" });
    try {
      const server = await ttEnsureServer();
      if (generationRef.current !== generation) return;
      setState({ status: "ready", port: server.port });
    } catch (error) {
      if (generationRef.current !== generation) return;
      const message = toErrorMessage(error);
      if (message.includes(CLI_NOT_INSTALLED_ERROR)) {
        setState({ status: "guide" });
      } else {
        setState({ status: "error", message });
      }
    }
  }, []);

  const runDetect = useCallback(
    async (generation: number) => {
      setState({ status: "checking" });
      try {
        const cli = await ttDetectCli();
        if (generationRef.current !== generation) return;
        if (!cli.installed) {
          setState({ status: "guide" });
          return;
        }
        await runEnsure(generation);
      } catch (error) {
        if (generationRef.current !== generation) return;
        setState({ status: "error", message: toErrorMessage(error) });
      }
    },
    [runEnsure],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!isTauriRuntime()) {
      // vite dev 浏览器预览：transport 走 /tt-dev proxy，无需 CLI 检测。
      setState({ status: "ready", port: 7680 });
      return;
    }
    void runDetect(generation);
  }, [runDetect]);

  /** error 态重试：直接重走 ensure（CLI 已确认安装过）。 */
  const retry = useCallback(() => {
    const generation = ++generationRef.current;
    void runEnsure(generation);
  }, [runEnsure]);

  /** guide 态重新检测：从 detect 重新走起（用户可能刚装好 CLI）。 */
  const recheck = useCallback(() => {
    const generation = ++generationRef.current;
    void runDetect(generation);
  }, [runDetect]);

  /** guide 态一键安装：Rust 侧执行固定 npm package，成功后重走 detect/ensure。 */
  const install = useCallback(() => {
    const generation = ++generationRef.current;
    setState({ status: "installing" });
    void ttInstallCli()
      .then(() => {
        if (generationRef.current !== generation) return;
        void runDetect(generation);
      })
      .catch((error) => {
        if (generationRef.current !== generation) return;
        setState({ status: "error", message: toErrorMessage(error) });
      });
  }, [runDetect]);

  return { state, retry, recheck, install };
}
