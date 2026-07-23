import { describe, expect, it } from "vitest";

import sidebar from "./sidebar";

describe("zh sidebar locale", () => {
  it("labels the primary new conversation nav item", () => {
    expect(sidebar.sidebar.quickNewThread).toBe("首页");
  });
});
