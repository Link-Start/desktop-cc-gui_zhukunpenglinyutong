import { invoke } from "@tauri-apps/api/core";

export async function loadBaiduTongjiScript(userAgent: string): Promise<void> {
  await invoke("load_baidu_tongji_script", { userAgent });
}

export async function sendBaiduTongjiBeacon(
  url: string,
  userAgent: string,
): Promise<void> {
  await invoke("send_baidu_tongji_beacon", { url, userAgent });
}
