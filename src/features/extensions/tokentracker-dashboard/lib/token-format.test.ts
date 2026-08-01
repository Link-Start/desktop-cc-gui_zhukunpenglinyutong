import { describe, expect, it } from "vitest";
// @ts-expect-error vendored JS module has no declaration file.
import * as tokenFormat from "./token-format.js";

const {
  TOKEN_FORMAT_MODES,
  formatTokenCount,
  getNextTokenFormatMode,
  normalizeTokenFormatMode,
} = tokenFormat;

describe("tokentracker token format", () => {
  it("cycles compact, Chinese compact, and full token formats", () => {
    expect(getNextTokenFormatMode(TOKEN_FORMAT_MODES.COMPACT)).toBe(
      TOKEN_FORMAT_MODES.CHINESE,
    );
    expect(getNextTokenFormatMode(TOKEN_FORMAT_MODES.CHINESE)).toBe(
      TOKEN_FORMAT_MODES.FULL,
    );
    expect(getNextTokenFormatMode(TOKEN_FORMAT_MODES.FULL)).toBe(
      TOKEN_FORMAT_MODES.COMPACT,
    );
    expect(normalizeTokenFormatMode("unknown")).toBe(TOKEN_FORMAT_MODES.COMPACT);
  });

  it("formats token counts with Chinese units", () => {
    expect(formatTokenCount(5_600_000_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "56亿",
    );
    expect(formatTokenCount(460_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "46万",
    );
    expect(formatTokenCount(1_200_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "120万",
    );
    expect(formatTokenCount(13_000_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "1300万",
    );
    expect(formatTokenCount(120_000_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "1.2亿",
    );
    expect(formatTokenCount(90_000, { mode: TOKEN_FORMAT_MODES.CHINESE })).toBe(
      "9万",
    );
  });
});
