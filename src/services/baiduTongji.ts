import { getCurrentWindow } from "@tauri-apps/api/window";

const BAIDU_TONGJI_SITE_ID = "daa60bcc45c658ee35054b93be3cf2e4";

declare global {
  interface Window {
    _hmt?: unknown[][];
  }
}

/**
 * 仅主窗口参与统计：About / 分离文件树 / SpecHub 等窗口加载同一份 index.html，
 * 若不区分会让每次开窗都计一次 PV。限定主窗口后 1 PV ≈ 1 次 App 启动。
 */
function isMainWindow(): boolean {
  try {
    return (getCurrentWindow().label ?? "main") === "main";
  } catch {
    // 非 Tauri 环境（浏览器、vitest/jsdom）按主窗口处理
    return true;
  }
}

/**
 * 注入百度统计（PV/UV）脚本。
 * 仅生产构建生效，避免开发环境的访问污染统计数据。
 *
 * 注意：Tauri 生产环境页面运行在 tauri://（macOS/Linux）或 http://tauri.localhost
 * （Windows），hm.js 探测到非 https 协议会把上报 gif 降级为 http://hm.baidu.com，
 * 因此 tauri.conf.json 的 CSP img-src/connect-src 必须放行 http://hm.baidu.com，
 * 否则 beacon 被拦截、后台永远零数据。
 */
export function installBaiduTongji(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  if (!isMainWindow()) {
    return;
  }
  window._hmt = window._hmt || [];
  const script = document.createElement("script");
  script.src = `https://hm.baidu.com/hm.js?${BAIDU_TONGJI_SITE_ID}`;
  script.async = true;
  document.head.appendChild(script);
}
