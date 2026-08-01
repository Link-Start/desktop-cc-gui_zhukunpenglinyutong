import { normalizeAgentIcon } from "../../../utils/agentIcons";
import type { MessageConversationItem } from "../utils/messageItemPredicates";
import type { MemoryContextSummary } from "../utils/context/messagesMemoryContext";
import type { NoteCardContextSummary } from "../utils/context/messagesNoteCardContext";
import {
  buildMessagePresentationMetadata,
  getPresentationContext,
} from "../../../conversation-presentation/normalizeConversationPresentation";
const AGENT_PROMPT_BLOCK_AT_TAIL_REGEX =
  /(?:\r?\n){2}##\s*Agent Role and Instructions\s*(?:\r?\n){2}([\s\S]*)$/;
const AGENT_PROMPT_NAME_LINE_REGEX =
  /^(?:agent\s*name|selected\s*agent|智能体(?:名称|标题)?|agent)\s*[:：]\s*(.+)$/i;
const AGENT_PROMPT_ICON_LINE_REGEX =
  /^(?:agent\s*icon|selected\s*agent\s*icon|智能体图标|agent\s*icon\s*id)\s*[:：]\s*(.+)$/i;

type AgentPromptParseResult = {
  text: string;
  selectedAgentName: string | null;
  selectedAgentIcon: string | null;
  hasInjectedAgentPromptBlock: boolean;
};

export type UserMessagePresentation = {
  displayText: string;
  stickyCandidateText: string;
  selectedAgentName: string | null;
  selectedAgentIcon: string | null;
  hasInjectedAgentPromptBlock: boolean;
  memorySummary: MemoryContextSummary | null;
  noteCardSummary: NoteCardContextSummary | null;
};

export type UserConversationSummary = {
  previewText: string;
  stickyCandidateText: string;
  imageCount: number;
  hasRenderableConversationContent: boolean;
};

type ResolveUserMessagePresentationParams = Pick<
  MessageConversationItem,
  "text" | "selectedAgentName" | "selectedAgentIcon" | "presentationMetadata"
> & {
  enableCollaborationBadge: boolean;
};

function normalizeSelectedAgentName(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/^#+\s*/, "").trim();
  return normalized || null;
}

function normalizeSelectedAgentIcon(value: string | null | undefined): string | null {
  return normalizeAgentIcon(value);
}

function isLikelyAgentDisplayName(value: string | null): boolean {
  if (!value) {
    return false;
  }
  if (value.length > 24) {
    return false;
  }
  return !/[。！？!?]/.test(value) && !/[,:，；;：]/.test(value);
}

function extractAgentNameFromPromptLine(value: string | null): string | null {
  const normalized = normalizeSelectedAgentName(value);
  if (!normalized) {
    return null;
  }
  const namedMatch = AGENT_PROMPT_NAME_LINE_REGEX.exec(normalized);
  if (namedMatch?.[1]) {
    return normalizeSelectedAgentName(namedMatch[1]);
  }
  const firstClause = normalized.split(/[,:，；;：。！？!?]/)[0]?.trim() ?? "";
  if (firstClause && firstClause.length <= 24) {
    return firstClause;
  }
  return isLikelyAgentDisplayName(normalized) ? normalized : null;
}

function extractAgentIconFromPromptLine(value: string | null): string | null {
  const normalized = normalizeSelectedAgentName(value);
  if (!normalized) {
    return null;
  }
  const iconMatch = AGENT_PROMPT_ICON_LINE_REGEX.exec(normalized);
  if (!iconMatch?.[1]) {
    return null;
  }
  return normalizeSelectedAgentIcon(iconMatch[1]);
}

function stripAgentPromptBlockFromUserText(
  text: string,
  fallbackAgentName: string | null,
  fallbackAgentIcon: string | null,
): AgentPromptParseResult {
  const match = AGENT_PROMPT_BLOCK_AT_TAIL_REGEX.exec(text);
  if (!match || typeof match.index !== "number" || match.index < 0) {
    return {
      text,
      selectedAgentName: null,
      selectedAgentIcon: null,
      hasInjectedAgentPromptBlock: false,
    };
  }
  const tailText = match[1] ?? "";
  if (!tailText.trim()) {
    return {
      text,
      selectedAgentName: null,
      selectedAgentIcon: null,
      hasInjectedAgentPromptBlock: false,
    };
  }
  const promptLines = tailText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const inferredAgentName = extractAgentNameFromPromptLine(promptLines[0] ?? null);
  const inferredAgentIcon = promptLines
    .map((line) => extractAgentIconFromPromptLine(line))
    .find((icon) => Boolean(icon)) ?? null;
  const agentName = fallbackAgentName ?? inferredAgentName;
  const agentIcon = fallbackAgentIcon ?? inferredAgentIcon;
  const baseText = text.slice(0, match.index).replace(/\s+$/, "");
  if (!baseText) {
    return {
      text,
      selectedAgentName: null,
      selectedAgentIcon: null,
      hasInjectedAgentPromptBlock: false,
    };
  }
  return {
    text: baseText,
    selectedAgentName: agentName,
    selectedAgentIcon: agentIcon,
    hasInjectedAgentPromptBlock: true,
  };
}

export function resolveUserMessagePresentation({
  text,
  selectedAgentName,
  selectedAgentIcon,
  presentationMetadata,
  enableCollaborationBadge,
}: ResolveUserMessagePresentationParams): UserMessagePresentation {
  const metadata = presentationMetadata ?? buildMessagePresentationMetadata(
    {
      id: "legacy-user-presentation",
      kind: "message",
      role: "user",
      text,
      selectedAgentName,
      selectedAgentIcon,
    },
    { enableCollaborationBadge },
  );
  const memoryContext = getPresentationContext(metadata, "memory");
  const noteCardContext = getPresentationContext(metadata, "note-card");
  const normalizedSelectedAgentName = normalizeSelectedAgentName(selectedAgentName);
  const normalizedSelectedAgentIcon = normalizeSelectedAgentIcon(selectedAgentIcon);
  const strippedAgentPrompt = stripAgentPromptBlockFromUserText(
    text,
    normalizedSelectedAgentName,
    normalizedSelectedAgentIcon,
  );
  return {
    displayText: metadata.displayText,
    stickyCandidateText: metadata.stickyCandidateText,
    selectedAgentName:
      strippedAgentPrompt.selectedAgentName ?? normalizedSelectedAgentName,
    selectedAgentIcon:
      strippedAgentPrompt.selectedAgentIcon ?? normalizedSelectedAgentIcon,
    hasInjectedAgentPromptBlock: strippedAgentPrompt.hasInjectedAgentPromptBlock,
    memorySummary: memoryContext
      ? {
          preview: memoryContext.preview,
          lines: memoryContext.lines,
          markdown: memoryContext.markdown,
          rawPayload: memoryContext.rawPayload,
          memoryPacks: memoryContext.packs,
          source: memoryContext.source,
          records: memoryContext.records,
        }
      : null,
    noteCardSummary: noteCardContext
      ? {
          notes: noteCardContext.notes,
          imagePaths: noteCardContext.imagePaths,
        }
      : null,
  };
}

export function resolveUserConversationSummary({
  text,
  images,
  selectedAgentName,
  selectedAgentIcon,
  enableCollaborationBadge,
  presentationMetadata,
}: Pick<
  MessageConversationItem,
  "text" | "images" | "selectedAgentName" | "selectedAgentIcon" | "presentationMetadata"
> & {
  enableCollaborationBadge: boolean;
}): UserConversationSummary {
  const presentation = resolveUserMessagePresentation({
    text,
    selectedAgentName,
    selectedAgentIcon,
    presentationMetadata,
    enableCollaborationBadge,
  });
  const previewText = presentation.stickyCandidateText.trim();
  const imageCount = Array.isArray(images) ? images.length : 0;
  return {
    previewText,
    stickyCandidateText: presentation.stickyCandidateText,
    imageCount,
    hasRenderableConversationContent: previewText.length > 0 || imageCount > 0,
  };
}
