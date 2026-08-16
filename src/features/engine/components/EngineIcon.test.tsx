import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EngineIcon } from "./EngineIcon";

describe("EngineIcon", () => {
  it("renders the Codex icon as a monochrome svg glyph", () => {
    const markup = renderToStaticMarkup(<EngineIcon engine="codex" size={16} />);

    expect(markup).toContain("<svg");
    expect(markup).toContain("fill=\"currentColor\"");
    expect(markup).not.toContain("<img");
  });

  it("keeps Claude as an image asset", () => {
    const markup = renderToStaticMarkup(<EngineIcon engine="claude" size={16} />);

    expect(markup).toContain("<img");
  });

  it("renders the OpenCode icon as a monochrome svg glyph", () => {
    const markup = renderToStaticMarkup(<EngineIcon engine="opencode" size={16} />);

    expect(markup).toContain("<svg");
    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain("M16 6H8v12h8V6zm4 16H4V2h16v20z");
    expect(markup).not.toContain("<img");
  });

  it.each(["kimi", "grok"] as const)(
    "renders the %s icon as a theme-aware monochrome svg glyph",
    (engine) => {
      const markup = renderToStaticMarkup(<EngineIcon engine={engine} size={16} />);

      expect(markup).toContain("<svg");
      expect(markup).toContain('fill="currentColor"');
      expect(markup).not.toContain("<img");
    },
  );

  it("renders DeepSeek Harness with the official whale icon", () => {
    const markup = renderToStaticMarkup(<EngineIcon engine="dsh" size={16} />);

    expect(markup).toContain("<img");
    expect(markup).toContain("alt=\"DeepSeek Harness\"");
    expect(markup).toMatch(/deepseek/i);
    expect(markup).not.toContain("<svg");
  });
});
