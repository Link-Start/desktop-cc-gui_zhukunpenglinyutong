/** @vitest-environment jsdom */
// ProviderIcon 的 agent target 渲染契约：7 个 agent 全部渲染为内联 <svg>。
// 历史 bug：上游对品牌 logo 走 <img src="/brand-logos/*.svg">，但 macOS
// WKWebView（Tauri webview）不绘制这些 SVG-in-<img>，skills 页 agent dot
// 全部空白；vendored 修复是把这 5 个品牌 logo 改为 ?raw 内联。
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// 经 @/ alias 引入，命中 tokentracker-dashboard-modules.d.ts 的模块声明
//（declare module 不支持相对 specifier）。
import { ProviderIcon } from "@/features/extensions/tokentracker-dashboard/ui/dashboard/components/ProviderIcon.jsx";

const AGENT_TARGET_IDS = ["claude", "codex", "grok", "antigravity", "gemini", "opencode", "hermes"];

describe("ProviderIcon agent targets", () => {
  it("renders every agent target as an inline svg (no <img>)", () => {
    for (const id of AGENT_TARGET_IDS) {
      const { container } = render(<ProviderIcon provider={id} size={18} />);
      expect(container.querySelector("img"), `${id} must not render <img>`).toBeNull();
      expect(container.querySelector("svg"), `${id} must render an inline svg`).toBeTruthy();
    }
  });

  it("keeps brand fills on inlined logos and strips their file-level size attrs", () => {
    const { container } = render(<ProviderIcon provider="claude" size={18} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("100%");
    expect(svg?.getAttribute("height")).toBe("100%");
    expect(container.innerHTML).toContain("#D97757");

    const { container: codex } = render(<ProviderIcon provider="codex" size={18} />);
    // 渐变 def 必须随内联内容一起保留，否则 codex logo 无填色。
    expect(codex.innerHTML).toContain("paint0_linear_170399_17154");
  });
});
