// 按引擎输入区偏好(model / effort / accessMode / collaborationMode)的模块级外部 store。
//
// 这些偏好曾经存在 app-shell 根组件的 useState(appSettings.lastComposerPrefsByEngine):
// 每次点击底栏切换按钮都 setAppSettings 在根上,导致整个 app-shell(2600+ 行,含全部面板)
// 重渲染;叠加存盘往返后的第二次 setSettings,一次点击要整体重画 2~3 遍 → 新会话里点切换
// 按钮掉到个位数帧率。改为外部 store 后,写入不再触达根;只有真正订阅偏好的组件重渲染。
//
// 磁盘持久化仍走 AppSettings(后端整体覆盖存盘),因此 persist 路径需在存盘时叠加本 store 的
// 最新快照,避免被其他设置保存覆盖。详见 app-shell.tsx 的 schedulePersistEnginePrefs 与
// useAppSettings.ts 的 saveSettings。与 composerDraftStore 同构。

import { useSyncExternalStore } from "react";
import type { ComposerEnginePrefs, EngineType } from "../../../types";
import {
  type ComposerEnginePrefsRecord,
  getComposerEnginePref,
  upsertComposerEnginePref,
} from "../../../app-shell-parts/composerEnginePrefs";

let state: ComposerEnginePrefsRecord = {};
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 命令式读取整份记录,供 effect / 事件回调使用(不订阅、不触发重渲染)。 */
export function getComposerEnginePrefsSnapshot(): ComposerEnginePrefsRecord {
  return state;
}

/** 命令式读取某引擎偏好,始终返回完整对象。 */
export function getComposerEnginePrefForEngine(
  engine: EngineType,
): ComposerEnginePrefs {
  return getComposerEnginePref(state, engine);
}

/**
 * 首次加载后用磁盘设置里的记录播种。值相同(同引用)时不通知,避免多余重渲染。
 * 只应在设置加载完成后调用一次(见 app-shell.tsx 的 prefsSeededRef)。
 */
export function seedComposerEnginePrefs(
  record: ComposerEnginePrefsRecord | undefined,
): void {
  const next = record ?? {};
  if (next === state) {
    return;
  }
  state = next;
  notify();
}

/**
 * 合并某引擎的偏好补丁。值未变化时(upsert 返回同引用)不写入、不通知,并返回 false,
 * 使调用方可跳过多余的存盘。发生变化时返回 true。
 */
export function setComposerEnginePref(
  engine: EngineType,
  patch: Partial<ComposerEnginePrefs>,
): boolean {
  const next = upsertComposerEnginePref(state, engine, patch);
  if (next === state) {
    return false;
  }
  state = next;
  notify();
  return true;
}

/** 订阅整份记录。快照引用稳定 → 值不变时 useSyncExternalStore 不会重渲染。 */
export function useComposerEnginePrefs(): ComposerEnginePrefsRecord {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function __resetComposerEnginePrefsStoreForTests(): void {
  state = {};
  listeners.clear();
}
