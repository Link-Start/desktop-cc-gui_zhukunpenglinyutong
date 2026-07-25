import type { EngineType } from "../../../types";
import { resolveEnhancerLocale } from "../../composer/components/ChatInputBox/hooks/usePromptEnhancer";

/**
 * 对话沉淀（save-as-command）的提炼指令。zh / en 双版本，结构对齐：
 * 角色、要求列表、"对话片段"段；claude 附加简洁约束（同 enhancer 策略）。
 * 产物是可通过 / 调用的斜杠命令模板（含 $ARGUMENTS 参数位）。
 */
export function buildDistillInstruction(
  sourceText: string,
  engine: EngineType,
  language: string | undefined,
): string {
  const locale = resolveEnhancerLocale(language);
  const baseInstruction =
    locale === "zh"
      ? [
          "你是一名斜杠命令模板提炼助手。",
          "把用户提供的对话片段提炼为可复用的自定义斜杠命令模板（用户之后在输入框键入 / 调用）。",
          "要求：",
          "- 提炼可复用的指令结构，不要复述对话内容本身。",
          "- 将随场景变化的部分替换为 $ARGUMENTS 参数位。",
          "- 保留原始意图与语言。",
          "- 只输出模板正文，不要解释、不要 markdown 代码块、不要标题、不要 frontmatter。",
          "",
          "对话片段：",
          sourceText,
        ]
      : [
          "You are a slash command template distillation assistant.",
          "Distill the provided conversation excerpt into a reusable custom slash command template (invoked later by typing / in the composer).",
          "Requirements:",
          "- Distill the reusable instruction structure; do not restate the conversation itself.",
          "- Replace situation-specific parts with $ARGUMENTS placeholders.",
          "- Preserve the original intent and language.",
          "- Output only the template body: no explanation, no markdown fence, no headings, no frontmatter.",
          "",
          "Conversation excerpt:",
          sourceText,
        ];

  if (engine === "claude") {
    const claudeConstraints =
      locale === "zh"
        ? [
            "- 模板保持简洁、面向执行，避免冗长。",
            "- 纯文本输出，不要 markdown 标题，不要多层列表。",
          ]
        : [
            "- Keep the template concise and execution-oriented; avoid verbosity.",
            "- Plain text output only, no markdown headings, no bullet nesting.",
          ];
    baseInstruction.splice(6, 0, ...claudeConstraints);
  }

  return baseInstruction.join("\n");
}
