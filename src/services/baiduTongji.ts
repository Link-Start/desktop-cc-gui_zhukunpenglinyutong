import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  loadBaiduTongjiScript,
  sendBaiduTongjiBeacon,
} from "./tauri/baiduTongji";
import { detectRendererPlatform } from "../utils/rendererPlatform";

const BAIDU_TONGJI_SITE_ID = "daa60bcc45c658ee35054b93be3cf2e4";
const BAIDU_TONGJI_HOST = "hm.baidu.com";
const BAIDU_TONGJI_BEACON_PATH = "/hm.gif";
const IMAGE_BRIDGE_MARKER = Symbol("ccgui.baiduTongjiImageBridge");

type BridgedImageConstructor = typeof Image & {
  [IMAGE_BRIDGE_MARKER]?: true;
};

declare global {
  interface Window {
    _hmt?: unknown[][];
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function isLinuxNativeRuntime(): boolean {
  return (
    window.__MOSSX_WEB_SERVICE__ !== true &&
    detectRendererPlatform() === "linux"
  );
}

function isBaiduTongjiBeacon(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === BAIDU_TONGJI_HOST &&
      url.pathname === BAIDU_TONGJI_BEACON_PATH
    );
  } catch {
    return false;
  }
}

function installNativeImageBridge(): void {
  const currentImage = window.Image as BridgedImageConstructor;
  if (currentImage[IMAGE_BRIDGE_MARKER]) {
    return;
  }
  const srcDescriptor = Object.getOwnPropertyDescriptor(
    window.HTMLImageElement.prototype,
    "src",
  );
  if (!srcDescriptor?.get || !srcDescriptor.set) {
    throw new Error("HTMLImageElement.src descriptor is unavailable");
  }

  const NativeImage = window.Image;
  const BridgedImage = function (width?: number, height?: number) {
    const image = new NativeImage(width, height);
    Object.defineProperty(image, "src", {
      configurable: true,
      enumerable: srcDescriptor.enumerable ?? true,
      get: () => srcDescriptor.get?.call(image),
      set: (value: string) => {
        const url = String(value);
        if (isBaiduTongjiBeacon(url)) {
          void sendBaiduTongjiBeacon(url, navigator.userAgent).catch((error) => {
            console.warn(
              "[baidu-tongji] failed to send native analytics beacon",
              errorMessage(error),
            );
          });
          return;
        }
        srcDescriptor.set?.call(image, url);
      },
    });
    return image;
  } as unknown as BridgedImageConstructor;

  Object.setPrototypeOf(BridgedImage, NativeImage);
  BridgedImage.prototype = NativeImage.prototype;
  BridgedImage[IMAGE_BRIDGE_MARKER] = true;
  window.Image = BridgedImage;
}

function installLinuxNativeBaiduTongji(): void {
  try {
    installNativeImageBridge();
  } catch (error) {
    console.warn(
      "[baidu-tongji] failed to install native analytics bridge",
      errorMessage(error),
    );
    return;
  }

  window._hmt = window._hmt || [];
  void loadBaiduTongjiScript(navigator.userAgent).catch((error) => {
    console.warn(
      "[baidu-tongji] failed to load native analytics script",
      errorMessage(error),
    );
  });
}

function installExternalBaiduTongji(): void {
  window._hmt = window._hmt || [];
  const script = document.createElement("script");
  script.src = `https://hm.baidu.com/hm.js?${BAIDU_TONGJI_SITE_ID}`;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * 注入百度统计（PV/UV）。仅 production main window 生效。
 *
 * Linux native WebKitGTK 在现场访问 hm.baidu.com 会触发 NetworkProcess/libsoup
 * crash，因此先安装 exact hm.gif Image bridge，再由 Rust reqwest 获取并执行官方
 * hm.js。payload 仍由官方脚本生成；只有 network transport 绕开 WebKit。
 * Windows/macOS 与 Linux Web Service browser 保持 external script behavior。
 */
export function installBaiduTongji(): void {
  if (!import.meta.env.PROD || !isMainWindow()) {
    return;
  }
  if (isLinuxNativeRuntime()) {
    installLinuxNativeBaiduTongji();
    return;
  }
  installExternalBaiduTongji();
}
