// @vitest-environment jsdom
/**
 * Shared V2 Send 开关单元测试（Wave 4 / Change B）。
 *
 * 验证：默认关闭、local override 开启/清除、jsdom 安全。
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

  it("defaults to disabled without build flag or override", () => {
    expect(isSharedV2SendEnabled()).toBe(false);
    expect(isSharedV2SendOverrideEnabled()).toBe(false);
  });

  it("enables via local override and clears with false/null", () => {
    expect(setSharedV2SendOverride(true)).toBe(true);
    expect(window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY)).toBe("1");
    expect(isSharedV2SendEnabled()).toBe(true);
    expect(isSharedV2SendOverrideEnabled()).toBe(true);

    // 重复开启：storage 未变化。
    expect(setSharedV2SendOverride(true)).toBe(false);

    expect(setSharedV2SendOverride(false)).toBe(true);
    expect(window.localStorage.getItem(SHARED_V2_SEND_STORAGE_KEY)).toBeNull();
    expect(isSharedV2SendEnabled()).toBe(false);

    // 已无 key：再次清除返回 false。
    expect(setSharedV2SendOverride(null)).toBe(false);
  });
});
