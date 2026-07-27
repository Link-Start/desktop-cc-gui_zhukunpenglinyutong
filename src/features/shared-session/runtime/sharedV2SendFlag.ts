/**
 * Shared V2 Send 开关（Wave 4 / Change B）。
 *
 * 职责：控制 Shared Session 发送链路是否走 V2（begin_turn → send → commit_turn
 * durable-first 编排）。默认关闭（dark launch，真实流量保持 V0）。
 *
 * 形态沿用 `sharedProjection/dataSource.ts` 的 flag 惯例：
 * build flag（`VITE_MOSSX_SHARED_V2_SEND`）或 localStorage override 任一开启即生效。
 */

export const SHARED_V2_SEND_STORAGE_KEY = "mossx.sharedV2Send";

function isEnabledFlag(value: unknown) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function readBooleanStorageFlag(key: string) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    return isEnabledFlag(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

/** 当前 local override 是否生效（供设置页/测试读取）。 */
export function isSharedV2SendOverrideEnabled() {
  return readBooleanStorageFlag(SHARED_V2_SEND_STORAGE_KEY);
}

/**
 * 写入测试 override。`true` 开启；`false` / `null` 删除 key，回到 build flag 判定。
 * 返回值表示 storage 是否实际变化，供调用方决定是否 reload。
 */
export function setSharedV2SendOverride(enabled: boolean | null) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const currentValue = window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY);
    if (enabled === true) {
      if (isEnabledFlag(currentValue)) {
        return false;
      }
      window.localStorage.setItem(SHARED_V2_SEND_STORAGE_KEY, "1");
      return true;
    }
    if (currentValue === null) {
      return false;
    }
    window.localStorage.removeItem(SHARED_V2_SEND_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Shared V2 Send 开关（默认关闭）。 */
export function isSharedV2SendEnabled() {
  return (
    import.meta.env.VITE_MOSSX_SHARED_V2_SEND === "true" ||
    isSharedV2SendOverrideEnabled()
  );
}
