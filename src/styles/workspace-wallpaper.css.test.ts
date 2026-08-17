import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace wallpaper styles", () => {
  it("loads after shell / messages / composer fills so translucency wins", () => {
    const bootstrap = readFileSync(
      resolve(process.cwd(), "src/bootstrap.ts"),
      "utf8",
    );
    const wallpaperImport = bootstrap.indexOf(
      'import "./styles/workspace-wallpaper.css"',
    );
    const firstRunImport = bootstrap.indexOf(
      'import "./styles/first-run-setup.css"',
    );
    const mainImport = bootstrap.indexOf('import "./styles/main.css"');
    const messagesImport = bootstrap.indexOf('import "./styles/messages.css"');
    const composerImport = bootstrap.indexOf('import "./styles/composer.css"');

    expect(wallpaperImport).toBeGreaterThan(-1);
    expect(wallpaperImport).toBeGreaterThan(firstRunImport);
    expect(wallpaperImport).toBeGreaterThan(mainImport);
    expect(wallpaperImport).toBeGreaterThan(messagesImport);
    expect(wallpaperImport).toBeGreaterThan(composerImport);
  });

  it("punches through the solid conversation and chrome fills", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/workspace-wallpaper.css"),
      "utf8",
    );
    expect(css).toContain(":root[data-workspace-wallpaper] .sidebar");
    expect(css).toContain(":root[data-workspace-wallpaper] .main");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .main",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .sidebar",
    );
    expect(css).toContain("background: var(--workspace-wallpaper-veil);");
    expect(css).toContain("--desktop-main-radius: 0;");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.layout-desktop .sidebar",
    );
    expect(css).toContain("border-right: 1px solid var(--border-subtle);");
    expect(css).toContain(":root[data-workspace-wallpaper] .messages");
    expect(css).toContain(":root[data-workspace-wallpaper] .right-panel");
    expect(css).toContain(":root[data-workspace-wallpaper] .composer");
    expect(css).toContain(":root[data-workspace-wallpaper] .fvp");
    expect(css).toContain("--workspace-wallpaper-veil:");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] {\n  --workspace-wallpaper-frost: 12px;\n}",
    );
    expect(css).not.toContain(
      "--workspace-wallpaper-wash-opacity: 8%;\n  --workspace-wallpaper-frost:",
    );
    expect(css).toContain(
      "backdrop-filter: blur(var(--workspace-wallpaper-frost, 12px))",
    );
    expect(css).toContain(".workspace-wallpaper::after");
    expect(css).toContain("prefers-reduced-transparency");
    expect(css).toContain(".app.reduced-transparency");
    expect(css).toContain("color-mix(");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .app.reduced-transparency .main",
    );
    expect(css).not.toContain("var(--workspace-wallpaper-veil-opacity");
    expect(css).not.toContain("var(--workspace-wallpaper-veil) 58%");
    expect(css).not.toContain(
      "color-mix(in srgb, var(--surface-topbar) 42%, transparent)",
    );
    expect(css).not.toContain(
      "color-mix(in srgb, var(--surface-right-panel) 28%, transparent)",
    );
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .drag-strip {\n  pointer-events: none;\n}",
    );
    expect(css).toContain(".home-titlebar-drag-strip");
    expect(css).toContain(
      ":root[data-workspace-wallpaper] .home-titlebar-drag-strip {\n  pointer-events: auto;\n}",
    );
  });
});
