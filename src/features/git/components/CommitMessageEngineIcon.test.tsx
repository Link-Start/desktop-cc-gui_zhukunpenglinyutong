// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommitMessageEngineIcon } from "./CommitMessageEngineIcon";

describe("CommitMessageEngineIcon", () => {
  it("delegates to EngineIcon for codex monochrome glyph", () => {
    const markup = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="codex" size={14} />,
    );

    expect(markup).toContain('fill="currentColor"');
    expect(markup).not.toContain("#10A37F");
    expect(markup).not.toContain("#10a37f");
  });

  it("delegates to EngineIcon for opencode square glyph", () => {
    const markup = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="opencode" size={14} />,
    );

    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain("M16 6H8v12h8V6zm4 16H4V2h16v20z");
    expect(markup).not.toContain("#3B82F6");
  });

  it("renders grok, kimi, and pi via the shared EngineIcon path glyphs", () => {
    const grok = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="grok" size={14} />,
    );
    const kimi = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="kimi" size={14} />,
    );
    const pi = renderToStaticMarkup(
      <CommitMessageEngineIcon engine="pi" size={14} />,
    );

    expect(grok).toContain("M9.27 15.29");
    expect(kimi).toContain("M21.846 0");
    expect(pi).toContain("M1 1h16.5v11H12v5.5H6.5V23H1V1zm5.5 5.5V12H12V6.5H6.5z");
    expect(pi).toContain('fill="currentColor"');
    expect(pi).not.toContain("<img");
  });
});
