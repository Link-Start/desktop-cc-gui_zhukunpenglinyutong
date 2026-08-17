import { describe, expect, it } from "vitest";
import {
  isMissingBinaryDetectError,
  retainFirstRunCardError,
  resolveFirstRunDetectCardError,
} from "./engineCardError";

describe("engineCardError", () => {
  it("treats detect missing-binary diagnostics as not installed, not as card errors", () => {
    expect(
      isMissingBinaryDetectError(
        "Failed to execute opencode: No such file or directory (os error 2)",
      ),
    ).toBe(true);
    expect(
      resolveFirstRunDetectCardError(
        false,
        "Failed to execute opencode: No such file or directory (os error 2)",
      ),
    ).toBeNull();
    expect(
      resolveFirstRunDetectCardError(
        false,
        "Failed to execute grok: The system cannot find the file specified. (os error 2)",
      ),
    ).toBeNull();
    expect(
      resolveFirstRunDetectCardError(
        false,
        "OpenCode CLI not found",
      ),
    ).toBeNull();
  });

  it("keeps real install or detect failures", () => {
    expect(
      resolveFirstRunDetectCardError(false, "Timeout detecting opencode CLI"),
    ).toBe("Timeout detecting opencode CLI");
    expect(retainFirstRunCardError("Install did not finish")).toBe(
      "Install did not finish",
    );
    expect(
      retainFirstRunCardError(
        "Failed to execute opencode: No such file or directory (os error 2)",
      ),
    ).toBeNull();
  });

  it("clears detect errors once the engine is installed", () => {
    expect(
      resolveFirstRunDetectCardError(true, "Timeout detecting opencode CLI"),
    ).toBeNull();
  });
});
