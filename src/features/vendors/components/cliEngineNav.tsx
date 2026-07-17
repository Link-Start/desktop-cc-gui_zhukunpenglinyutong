import claudeCodeCliIcon from "@lobehub/icons-static-svg/icons/claudecode-color.svg";
import claudeCodeCliMonoIcon from "@lobehub/icons-static-svg/icons/claudecode.svg";
import codeBuddyCliMonoIcon from "@lobehub/icons-static-svg/icons/codebuddy.svg";
import codexCliIcon from "@lobehub/icons-static-svg/icons/codex-color.svg";
import codexCliMonoIcon from "@lobehub/icons-static-svg/icons/codex.svg";
import copilotCliMonoIcon from "@lobehub/icons-static-svg/icons/copilot.svg";
import cursorCliIcon from "@lobehub/icons-static-svg/icons/cursor.svg";
import geminiCliMonoIcon from "@lobehub/icons-static-svg/icons/geminicli.svg";
import glmCliMonoIcon from "@lobehub/icons-static-svg/icons/chatglm.svg";
import huaweiMonoIcon from "@lobehub/icons-static-svg/icons/huawei.svg";
import kimiCliIcon from "@lobehub/icons-static-svg/icons/kimi.svg";
import kimiCliMonoIcon from "@lobehub/icons-static-svg/icons/kimi.svg";
import openCodeCliIcon from "@lobehub/icons-static-svg/icons/opencode.svg";
import openCodeCliMonoIcon from "@lobehub/icons-static-svg/icons/opencode.svg";
import piCliIcon from "@lobehub/icons-static-svg/icons/pi.svg";
import piCliMonoIcon from "@lobehub/icons-static-svg/icons/pi.svg";
import qoderCliMonoIcon from "@lobehub/icons-static-svg/icons/qoder.svg";
import qwenCliMonoIcon from "@lobehub/icons-static-svg/icons/qwen.svg";
import traeCliMonoIcon from "@lobehub/icons-static-svg/icons/trae.svg";
import { cn } from "@/lib/utils";
import type { VendorTab } from "../types";

type UnsupportedCliEngineId =
  | "opencode"
  | "qoder"
  | "qwen"
  | "codebuddy"
  | "copilot"
  | "cursor"
  | "gemini"
  | "glm"
  | "trae"
  | "deveco"
  | "pi"
  | "iflow"
  | "kimi"
  | "ruixing"
  | "feishu"
  | "kiro";

export type CliEngineId = VendorTab | UnsupportedCliEngineId;

export type CliEngineNavItem =
  | { key: VendorTab; label: string; hasConfig: boolean; supported: true; docsUrl: string }
  | { key: UnsupportedCliEngineId; label: string; supported: false; docsUrl: string };

export const CLI_DOCS_HREF_BY_ID: Record<CliEngineId, string> = {
  claude: "https://code.claude.com/docs/en/cli-reference",
  codex: "https://learn.chatgpt.com/docs/codex/cli",
  gemini: "https://developers.google.com/gemini-code-assist/docs/gemini-cli",
  opencode: "https://opencode.ai/docs/",
  glm: "https://docs.z.ai/devpack/quick-start",
  trae: "https://docs.trae.ai/",
  cursor: "https://cursor.com/docs/cli/overview",
  kimi: "https://www.kimi.com/code/docs/en/",
  ruixing: "https://open.lkcoffee.com/docs",
  deveco: "https://developer.huawei.com/consumer/en/doc/harmonyos-guides/ide-commandline-get",
  pi: "https://pi.dev/docs/latest/usage",
  iflow: "https://github.com/iflow-ai/iflow-cli",
  qoder: "https://docs.qoder.com/en/cli/using-cli",
  qwen: "https://qwenlm.github.io/qwen-code-docs/en/users/overview/",
  codebuddy: "https://www.codebuddy.ai/docs/cli/quickstart",
  copilot: "https://docs.github.com/en/copilot/how-tos/copilot-cli",
  feishu: "https://open.feishu.cn/document/home/index",
  kiro: "https://kiro.dev/docs/cli/",
};

const CLI_ICON_BY_ID: Record<CliEngineId, string | null> = {
  claude: claudeCodeCliIcon,
  codex: codexCliIcon,
  gemini: geminiCliMonoIcon,
  opencode: openCodeCliIcon,
  glm: glmCliMonoIcon,
  trae: traeCliMonoIcon,
  cursor: cursorCliIcon,
  kimi: kimiCliIcon,
  ruixing: null,
  deveco: huaweiMonoIcon,
  pi: piCliIcon,
  iflow: null,
  qoder: qoderCliMonoIcon,
  qwen: qwenCliMonoIcon,
  codebuddy: codeBuddyCliMonoIcon,
  copilot: copilotCliMonoIcon,
  feishu: null,
  kiro: null,
};

const CLI_MONO_ICON_BY_ID: Record<CliEngineId, string | null> = {
  claude: claudeCodeCliMonoIcon,
  codex: codexCliMonoIcon,
  gemini: geminiCliMonoIcon,
  opencode: openCodeCliMonoIcon,
  glm: glmCliMonoIcon,
  trae: traeCliMonoIcon,
  cursor: cursorCliIcon,
  kimi: kimiCliMonoIcon,
  ruixing: null,
  deveco: huaweiMonoIcon,
  pi: piCliMonoIcon,
  iflow: null,
  qoder: qoderCliMonoIcon,
  qwen: qwenCliMonoIcon,
  codebuddy: codeBuddyCliMonoIcon,
  copilot: copilotCliMonoIcon,
  feishu: null,
  kiro: null,
};

const COLOR_CLI_ICON_IDS = new Set<CliEngineId>(["claude", "codex"]);

export function buildCliEngineNavItems(options: {
  claudeHasConfig: boolean;
  codexHasConfig: boolean;
}): CliEngineNavItem[] {
  return [
    { key: "claude", label: "Claude Code CLI", hasConfig: options.claudeHasConfig, supported: true, docsUrl: CLI_DOCS_HREF_BY_ID.claude },
    { key: "codex", label: "Codex CLI", hasConfig: options.codexHasConfig, supported: true, docsUrl: CLI_DOCS_HREF_BY_ID.codex },
    { key: "gemini", label: "Gemini CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.gemini },
    { key: "opencode", label: "OpenCode CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.opencode },
    { key: "glm", label: "GLM CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.glm },
    { key: "trae", label: "Trae CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.trae },
    { key: "cursor", label: "Cursor CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.cursor },
    { key: "kimi", label: "Kimi CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.kimi },
    { key: "ruixing", label: "瑞幸 CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.ruixing },
    { key: "deveco", label: "DevEco CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.deveco },
    { key: "pi", label: "PI CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.pi },
    { key: "iflow", label: "iFlow CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.iflow },
    { key: "qoder", label: "Qoder CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.qoder },
    { key: "qwen", label: "Qwen CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.qwen },
    { key: "codebuddy", label: "CodeBuddy CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.codebuddy },
    { key: "copilot", label: "Copilot CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.copilot },
    { key: "feishu", label: "飞书 CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.feishu },
    { key: "kiro", label: "Kiro CLI", supported: false, docsUrl: CLI_DOCS_HREF_BY_ID.kiro },
  ];
}

export function CliIcon({
  id,
  label,
  monochrome = false,
}: {
  id: CliEngineId;
  label: string;
  monochrome?: boolean;
}) {
  const useMonochrome = monochrome || !COLOR_CLI_ICON_IDS.has(id);
  const icon = useMonochrome ? CLI_MONO_ICON_BY_ID[id] : CLI_ICON_BY_ID[id];
  return icon ? (
    <img
      src={icon}
      alt=""
      className={cn("vendor-cli-logo-img", useMonochrome && "vendor-cli-logo-img-mono")}
      aria-hidden="true"
    />
  ) : (
    <span
      className={cn(
        "vendor-cli-logo",
        `vendor-cli-logo-${id}`,
        useMonochrome && "vendor-cli-logo-mono",
      )}
      aria-hidden="true"
    >
      {label.charAt(0)}
    </span>
  );
}
