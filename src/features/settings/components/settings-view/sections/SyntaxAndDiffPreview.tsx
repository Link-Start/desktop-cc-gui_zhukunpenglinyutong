import { useTranslation } from "react-i18next";
import Palette from "lucide-react/dist/esm/icons/palette";

/**
 * 跟随当前主题 preset 渲染的紧凑代码 + diff 预览。
 *
 * 设计目的:
 * - 让用户在切换 preset 时直接看到代码 token (keyword/string/comment/...) 与
 *   diff 加/减行配色如何跟随 preset。
 * - 避免假设特定 css 容器已经渲染,直接复用 messages/file-tree/diff-viewer
 *   的 selector 上下文 — `<pre class="markdown-codeblock">`,
 *   `<span class="file-preview-line-text">`,
 *   `<div class="diff-line-content">` 都各自消费对应的 `--*-token-*` 变量。
 */
type SyntaxAndDiffPreviewProps = {
  appearance: "light" | "dark";
};

function SampleCodeLine({
  surface = "sidebar",
  compact = false,
}: {
  surface?: string;
  compact?: boolean;
}) {
  return (
    <span className="file-preview-line-text">
      <span className="token keyword">const</span>{" "}
      <span className="token function">themePreview</span>
      <span className="token operator">:</span>{" "}
      <span className="token class-name">ThemeConfig</span>{" "}
      <span className="token operator">=</span>{" "}
      <span className="token punctuation">{"{"}</span>{" "}
      <span className="token property">surface</span>
      <span className="token operator">:</span>{" "}
      <span className="token string">&quot;{surface}&quot;</span>
      {!compact && (
        <>
          <span className="token punctuation">,</span>{" "}
          <span className="token property">contrast</span>
          <span className="token operator">:</span>{" "}
          <span className="token number">42</span>{" "}
        </>
      )}
      <span className="token punctuation">{"}"}</span>
      <span className="token punctuation">;</span>
    </span>
  );
}

export function SyntaxAndDiffPreview({ appearance }: SyntaxAndDiffPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="settings-field settings-basic-item settings-theme-preview-item">
      <div className="settings-basic-field-header">
        <Palette className="settings-basic-field-icon" aria-hidden />
        <span className="settings-basic-field-label">
          {t("settings.themePreviewTitle", { defaultValue: "代码 & Diff 配色预览" })}
        </span>
      </div>
      <div className="settings-help theme-preview-help">
        {t("settings.themePreviewHelp", {
          defaultValue:
            "随当前主题 preset 实时刷新。下方面板展示代码块 / Markdown / 文件预览 / Diff 视图所用的 token 与 diff 颜色。",
        })}
      </div>
      <div
        className="theme-preview-grid"
        data-appearance={appearance}
        role="group"
        aria-label={t("settings.themePreviewTitle", { defaultValue: "代码 & Diff 配色预览" })}
      >
        <div className="theme-preview-grid__code-col">
          <div className="theme-preview-grid__panel">
            <div className="theme-preview-grid__panel-header">
              {t("settings.themePreviewCodePanel", { defaultValue: "代码块 (Markdown)" })}
            </div>
            <pre className="markdown-codeblock theme-preview-codeblock">
              <code>
                <span className="theme-preview-codeblock__line">
                  <span className="theme-preview-line-num">1</span>
                  <SampleCodeLine />
                </span>
                <span className="theme-preview-codeblock__line">
                  <span className="theme-preview-line-num">2</span>
                  <span className="file-preview-line-text token comment">
                    {"// theme-aware syntax tokens"}
                  </span>
                </span>
              </code>
            </pre>
          </div>
          <div className="theme-preview-grid__panel">
            <div className="theme-preview-grid__panel-header">
              {t("settings.themePreviewFilePanel", { defaultValue: "文件预览 (file-view)" })}
            </div>
            <pre className="fvp-line-text theme-preview-codeblock">
              <code>
                <span className="theme-preview-codeblock__line">
                  <span className="theme-preview-line-num">1</span>
                  <SampleCodeLine />
                </span>
                <span className="theme-preview-codeblock__line">
                  <span className="theme-preview-line-num">2</span>
                  <span className="file-preview-line-text token comment">
                    {"// file-view preview"}
                  </span>
                </span>
              </code>
            </pre>
          </div>
        </div>

        <div className="theme-preview-grid__diff-col">
          <div className="theme-preview-grid__panel">
            <div className="theme-preview-grid__panel-header">
                {t("settings.themePreviewDiffPanel", { defaultValue: "Diff 行级" })}
            </div>
            <pre className="diff-line-content theme-preview-diff">
              <span className="theme-preview-diff__line theme-preview-diff__line--del">
                <span className="theme-preview-line-num">1</span>
                <SampleCodeLine compact />
              </span>
              <span className="theme-preview-diff__line theme-preview-diff__line--add">
                <span className="theme-preview-line-num">2</span>
                <SampleCodeLine surface="sidebar-elevated" compact />
              </span>
            </pre>
            <div className="theme-preview-grid__legend">
              <span className="theme-preview-legend theme-preview-legend--add">
                <span className="theme-preview-legend__dot" />
                {t("settings.themePreviewLegendAdd", { defaultValue: "新增" })}
                <code>text · bg · gutter</code>
              </span>
              <span className="theme-preview-legend theme-preview-legend--del">
                <span className="theme-preview-legend__dot" />
                {t("settings.themePreviewLegendDel", { defaultValue: "删除" })}
                <code>text · bg · gutter</code>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
