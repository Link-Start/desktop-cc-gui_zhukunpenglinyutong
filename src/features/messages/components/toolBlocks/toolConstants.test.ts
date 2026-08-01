import i18n from "../../../../i18n";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EDIT_TOOL_NAMES,
  getToolDisplayName,
  isBashTool,
  resolveToolStatus,
} from "./toolConstants";

describe("resolveToolStatus", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });

  afterEach(async () => {
    await i18n.changeLanguage("zh");
  });

  it("returns completed for explicit completion status even without output", () => {
    expect(resolveToolStatus("completed", false)).toBe("completed");
    expect(resolveToolStatus("success", false)).toBe("completed");
    expect(resolveToolStatus("done", false)).toBe("completed");
  });

  it("returns processing for in-progress status", () => {
    expect(resolveToolStatus("started", false)).toBe("processing");
    expect(resolveToolStatus("running", false)).toBe("processing");
    expect(resolveToolStatus("in_progress", false)).toBe("processing");
  });

  it("returns failed for error status", () => {
    expect(resolveToolStatus("failed", false)).toBe("failed");
    expect(resolveToolStatus("error", true)).toBe("failed");
  });

  it("falls back to output presence when status is unknown", () => {
    expect(resolveToolStatus("", true)).toBe("completed");
    expect(resolveToolStatus("unknown", false)).toBe("processing");
  });

  it("maps askuserquestion to ask user question display name", () => {
    expect(getToolDisplayName("askuserquestion")).toBe("询问用户问题");
  });

  it("follows the active locale when component translation context is unavailable", async () => {
    await i18n.changeLanguage("en");
    expect(getToolDisplayName("webfetch")).toBe("Web fetch");
  });

  it("treats exec_command and write_stdin as command tools", () => {
    expect(isBashTool("exec_command")).toBe(true);
    expect(isBashTool("write_stdin")).toBe(true);
  });

  it("preserves the edit tool name export surface", () => {
    expect(EDIT_TOOL_NAMES.has("edit")).toBe(true);
  });
});
