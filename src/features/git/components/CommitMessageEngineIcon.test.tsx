import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommitMessageEngineIcon } from "./CommitMessageEngineIcon";

describe("CommitMessageEngineIcon", () => {
  it("renders the Codex commit generator icon as a monochrome glyph", () => {
    const markup = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="codex" size={14} />,
    );

    expect(markup).toContain('fill="currentColor"');
    expect(markup).not.toContain("#10A37F");
    expect(markup).not.toContain("#10a37f");
  });

  it("renders the OpenCode commit generator icon as the official square glyph", () => {
    const markup = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="opencode" size={14} />,
    );

    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain("M16 6H8v12h8V6zm4 16H4V2h16v20z");
    expect(markup).not.toContain("#3B82F6");
  });
});
