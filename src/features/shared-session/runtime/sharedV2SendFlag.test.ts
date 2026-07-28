// @vitest-environment jsdom
/**
 * Shared V2 Send 开关单元测试（Wave 4 / Change B）。
 *
 * 验证：默认开启、local override 显式回滚/清除、jsdom 安全。
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  isSharedV2SendEnabled,
  isSharedV2SendOverrideEnabled,
  setSharedV2SendOverride,
  SHARED_V2_SEND_STORAGE_KEY,
} from "./sharedV2SendFlag";

describe("sharedV2SendFlag", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to enabled without build flag or override", () => {
    expect(isSharedV2SendEnabled()).toBe(true);
    expect(isSharedV2SendOverrideEnabled()).toBe(false);
  });

  it("supports explicit negative rollback and clearing the override", () => {
    expect(setSharedV2SendOverride(true)).toBe(true);
    expect(window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY)).toBe("1");
    expect(isSharedV2SendEnabled()).toBe(true);
    expect(isSharedV2SendOverrideEnabled()).toBe(true);

    // 重复开启：storage 未变化。
    expect(setSharedV2SendOverride(true)).toBe(false);

    expect(setSharedV2SendOverride(false)).toBe(true);
    expect(window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY)).toBe("0");
    expect(isSharedV2SendEnabled()).toBe(false);
    expect(isSharedV2SendOverrideEnabled()).toBe(false);

    expect(setSharedV2SendOverride(false)).toBe(false);
    expect(setSharedV2SendOverride(null)).toBe(true);
    expect(window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY)).toBeNull();
    expect(isSharedV2SendEnabled()).toBe(true);
  });
});
