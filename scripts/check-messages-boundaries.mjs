#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const BASELINE = {
  inbound: [
  "src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts|import|../features/messages/types",
  "src/app-shell.tsx|import|./features/messages/types",
  "src/features/app/components/sidebarInternals.ts|import|../../messages/components/toolBlocks/toolConstants",
  "src/features/composer/components/ChatInputBox/ChatInputBoxFooter.manual-memory.test.tsx|mock|../../../messages/components/Markdown",
  "src/features/composer/components/ChatInputBox/ChatInputBoxFooter.tsx|import|../../../messages/components/Markdown",
  "src/features/composer/components/ChatInputBox/ContextBar.tsx|import|../../../messages/constants/liveCanvasControls",
  "src/features/composer/components/ComposerInput.manual-memory.test.tsx|mock|../../messages/components/Markdown",
  "src/features/composer/components/ComposerInput.tsx|import|../../messages/components/Markdown",
  "src/features/context-ledger/components/ContextLedgerPanel.tsx|import|../../messages/components/Markdown",
  "src/features/engine-task-output/utils/engineTaskOutputProjection.ts|import|../../messages/utils/agentTaskNotification",
  "src/features/files/components/FileMarkdownPreview.tsx|import|../../messages/rendering/markdown/codeBlockLanguageIcon",
  "src/features/git/components/GitDiffViewer.tsx|import|../../messages/components/Markdown",
  "src/features/git/components/WorkspaceEditableDiffReviewSurface.tsx|import|../../messages/utils/diffUtils",
  "src/features/layout/hooks/activeCanvasStore.ts|import|../../messages/types/messagesTypes",
  "src/features/layout/hooks/conversationCanvasNode.tsx|import|../../messages/components/conversation/MessageForkConfirmDialog",
  "src/features/layout/hooks/conversationCanvasNode.tsx|import|../../messages/components/Messages",
  "src/features/layout/hooks/conversationCanvasNode.tsx|import|../../messages/types/messagesTypes",
  "src/features/layout/hooks/layoutNodesTypes.ts|import|../../messages/types",
  "src/features/layout/hooks/layoutNodesTypes.ts|import|../../messages/utils/recovery/runtimeReconnect",
  "src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx|mock|../../messages/components/Messages",
  "src/features/layout/hooks/useLayoutNodes.tsx|import|../../messages/presentation/presentationProfile",
  "src/features/note-cards/components/WorkspaceNoteCardPanel.test.tsx|mock|../../messages/components/Markdown",
  "src/features/note-cards/components/WorkspaceNoteCardPanel.tsx|import|../../messages/components/Markdown",
  "src/features/operation-facts/operationFacts.ts|import|../messages/components/toolBlocks/toolConstants",
  "src/features/project-memory/components/ProjectMemoryPanel.tsx|import|../../messages/components/Markdown",
  "src/features/session-activity/adapters/buildWorkspaceSessionActivity.ts|import|../../messages/components/toolBlocks/toolConstants",
  "src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx|import|../../messages/components/Markdown",
  "src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx|import|../../../../messages/components/Markdown",
  "src/features/spec/components/SpecHub.test-support.tsx|mock|../../messages/components/Markdown",
  "src/features/status-panel/components/CheckpointPanel.tsx|import|../../messages/components/toolBlocks/FileIcon",
  "src/features/status-panel/components/FileChangesList.tsx|import|../../messages/components/toolBlocks/FileIcon",
  "src/features/status-panel/hooks/useStatusPanelData.ts|import|../../messages/components/toolBlocks/toolConstants",
  "src/features/threads/loaders/claudeHistoryLoader.ts|import|../../messages/utils/diffUtils",
  "src/features/threads/utils/claudeRewindRestore.ts|import|../../messages/components/toolBlocks/toolConstants",
  "src/features/update/components/ReleaseNotesModal.test.tsx|mock|../../messages/components/Markdown",
  "src/features/update/components/ReleaseNotesModal.tsx|import|../../messages/components/Markdown",
  "src/utils/threadItemsFileChanges.ts|import|../features/messages/utils/diffUtils",
  "src/utils/threadItemsUserMessage.ts|import|../features/messages/utils/commandMessageTags"
],
  outbound: [
  "src/features/messages/components/chatCanvasSmoke.test.tsx|import|../../threads/contracts/conversationAssembler",
  "src/features/messages/components/chatCanvasSmoke.test.tsx|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/components/context/IntentCanvasContextSummaryCard.tsx|import|../../../intent-canvas/utils/messageContext",
  "src/features/messages/components/conversation/MessageForkConfirmDialog.tsx|import|../../../threads/constants/codexProviderProfiles",
  "src/features/messages/components/conversation/MessagesInlinePrompts.tsx|import|../../../app/components/ApprovalToasts",
  "src/features/messages/components/conversation/MessagesInlinePrompts.tsx|import|../../../app/components/RequestUserInputMessage",
  "src/features/messages/components/conversation/MessagesOutlineFloater.test.tsx|import|../../../markdown/fastMarkdownRenderer",
  "src/features/messages/components/conversation/MessagesOutlineFloater.tsx|import|../../../markdown/fastMarkdownRenderer",
  "src/features/messages/components/conversation/TurnFilesChangedCard.tsx|import|../../../files/utils/fileTreeIcons",
  "src/features/messages/components/Markdown.image-fullscreen.test.tsx|mock|../../markdown/imageFullscreen",
  "src/features/messages/components/Markdown.math-rendering.test.tsx|import|../../markdown/markdownMath",
  "src/features/messages/components/Markdown.outline-streaming.test.tsx|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/components/Markdown.tsx|export|../../markdown/markdownMath",
  "src/features/messages/components/Markdown.tsx|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/components/Markdown.tsx|import|../../markdown/imageFullscreen",
  "src/features/messages/components/Markdown.tsx|import|../../markdown/markdownMath",
  "src/features/messages/components/Markdown.tsx|import|../../markdown/messageMarkdownHeavyIslands",
  "src/features/messages/components/Markdown.tsx|import|../../markdown/messageMarkdownPrecompute",
  "src/features/messages/components/Messages.live-behavior.test.tsx|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/components/Messages.live-markdown-streaming.test.tsx|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/components/Messages.test.tsx|import|../../agent-orchestration/utils/navigationEvents",
  "src/features/messages/components/Messages.test.tsx|import|../../tasks/types",
  "src/features/messages/components/Messages.tsx|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/components/Messages.tsx|import|../../threads/hooks/useStreamActivityPhase",
  "src/features/messages/components/Messages.tsx|import|../../threads/utils/streamLatencyDiagnostics",
  "src/features/messages/components/Messages.windows-render-mitigation.test.tsx|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/components/Messages.windows-render-mitigation.test.tsx|mock|../../threads/utils/streamLatencyDiagnostics",
  "src/features/messages/components/MessagesRows.tsx|import|../../browser-agent",
  "src/features/messages/components/MessagesRows.tsx|import|../../engine-task-output/components/EngineTaskOutputInspector",
  "src/features/messages/components/MessagesRows.tsx|import|../../engine-task-output/hooks/useEngineTaskOutputSnapshot",
  "src/features/messages/components/MessagesRows.tsx|import|../../engine-task-output/types",
  "src/features/messages/components/MessagesRows.tsx|import|../../engine-task-output/utils/engineTaskOutputProjection",
  "src/features/messages/components/MessagesRows.tsx|import|../../intent-canvas/utils/messageContext",
  "src/features/messages/components/MessagesRows.tsx|import|../../threads/hooks/useLiveAssistantText",
  "src/features/messages/components/MessagesRows.tsx|import|../../threads/hooks/useStreamActivityPhase",
  "src/features/messages/components/MessagesRows.tsx|import|../../threads/utils/realtimePerfFlags",
  "src/features/messages/components/MessagesRows.tsx|import|../../threads/utils/streamLatencyDiagnostics",
  "src/features/messages/components/MessagesRows.tsx|import-type|../../markdown/fastMarkdownRenderer",
  "src/features/messages/components/MessagesTimeline.tsx|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/hooks/useConversationNoteCaptureMenu.ts|import|../../note-cards/types",
  "src/features/messages/hooks/useMessageOutlineActive.test.tsx|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/hooks/useMessageOutlineActive.ts|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/orchestration/components/MessagesLinkedRunBanner.tsx|import|../../../agent-orchestration/utils/navigationEvents",
  "src/features/messages/orchestration/components/MessagesLinkedRunBanner.tsx|import|../../../tasks/utils/taskRunSurface",
  "src/features/messages/orchestration/models/messagesTimelineModels.ts|import|../../../threads/utils/streamLatencyDiagnostics",
  "src/features/messages/presentation/messagesOutlineState.test.ts|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/presentation/messagesOutlineState.ts|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/presentation/messagesReasoning.ts|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/presentation/messagesUserPresentation.ts|import|../../browser-agent",
  "src/features/messages/presentation/messagesUserPresentation.ts|import|../../intent-canvas/utils/messageContext",
  "src/features/messages/presentation/presentationProfile.test.ts|import|../../threads/assembly/conversationMigrationGates",
  "src/features/messages/presentation/presentationProfile.ts|import|../../threads/assembly/conversationMigrationGates",
  "src/features/messages/presentation/presentationProfile.ts|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/rendering/markdown/FullMarkdownRuntime.tsx|import|../../../markdown/markdownMath",
  "src/features/messages/rendering/markdown/MermaidBlock.fullscreen.test.tsx|import|../../../markdown/mermaidFullscreen",
  "src/features/messages/rendering/markdown/MermaidBlock.tsx|import|../../../markdown/mermaidFullscreen",
  "src/features/messages/rendering/markdown/MermaidBlock.tsx|import|../../../theme/utils/themeAppearance",
  "src/features/messages/rows/components/PresentationRows.tsx|import|../../../git/components/DiffBlock",
  "src/features/messages/rows/presentation/messagesStreamingComplexity.ts|import|../../../threads/utils/streamLatencyDiagnostics",
  "src/features/messages/types/messagesTypes.ts|import|../../note-cards/types",
  "src/features/messages/types/messagesTypes.ts|import|../../tasks/types",
  "src/features/messages/types/messagesTypes.ts|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/utils/context/messagesMemoryContext.ts|import|../../../project-memory/utils/memoryMarkers",
  "src/features/messages/utils/context/messagesMemoryContext.ts|import|../../../project-memory/utils/projectMemoryRetrievalPack",
  "src/features/messages/utils/context/messagesMemoryContext.ts|import|../../../threads/assembly/conversationNormalization",
  "src/features/messages/utils/context/messagesNoteCardContext.ts|import|../../../note-cards/utils/noteCardContextInjection",
  "src/features/messages/utils/context/messagesNoteCardContext.ts|import|../../../threads/assembly/conversationNormalization",
  "src/features/messages/utils/messageOutlineExtractor.ts|import|../../markdown/fastMarkdownRenderer",
  "src/features/messages/utils/messagesRenderUtils.ts|import|../../threads/contracts/conversationCurtainContracts",
  "src/features/messages/utils/recovery/runtimeReconnect.ts|import|../../../threads/utils/stabilityDiagnostics"
],
};

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");
const featuresRoot = path.join(srcRoot, "features");
const messagesRoot = path.join(featuresRoot, "messages");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function getScriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function collectImports(file) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, getScriptKind(file));
  const imports = [];
  const add = (kind, node, literal) => imports.push({
    kind,
    specifier: literal.text,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
  });

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add("import", node, node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add("export", node, node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      add("import-type", node, node.argument.literal);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
      const expression = node.expression;
      if (expression.kind === ts.SyntaxKind.ImportKeyword) {
        add("dynamic-import", node, node.arguments[0]);
      } else if (ts.isIdentifier(expression) && expression.text === "require") {
        add("require", node, node.arguments[0]);
      } else if (ts.isPropertyAccessExpression(expression) && expression.name.text === "mock" && ts.isIdentifier(expression.expression) && ["vi", "jest"].includes(expression.expression.text)) {
        add("mock", node, node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function resolveTarget(file, specifier) {
  if (specifier.startsWith("@/")) return path.join(srcRoot, specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(file), specifier);
  return null;
}

function isInside(candidate, directory) {
  return candidate === directory || candidate.startsWith(directory + path.sep);
}

function canonicalKey(record) {
  return [record.file, record.kind, record.specifier].join("|");
}

function compareAgainstBaseline(records, baseline) {
  const remaining = new Map();
  for (const item of baseline) remaining.set(item, (remaining.get(item) ?? 0) + 1);
  const additions = [];
  for (const record of records) {
    const key = canonicalKey(record);
    const allowed = remaining.get(key) ?? 0;
    if (allowed > 0) remaining.set(key, allowed - 1);
    else additions.push(record);
  }
  const removed = [...remaining.values()].reduce((total, count) => total + count, 0);
  return { additions, removed };
}

const inbound = [];
const outbound = [];
for (const absoluteFile of walk(srcRoot)) {
  const sourceIsMessages = isInside(absoluteFile, messagesRoot);
  const file = path.relative(repoRoot, absoluteFile).split(path.sep).join("/");
  for (const imported of collectImports(absoluteFile)) {
    const target = resolveTarget(absoluteFile, imported.specifier);
    if (!target) continue;
    if (!sourceIsMessages && isInside(target, messagesRoot) && target !== messagesRoot && target !== path.join(messagesRoot, "index")) {
      inbound.push({ ...imported, file });
    }
    if (sourceIsMessages && isInside(target, featuresRoot) && !isInside(target, messagesRoot)) {
      outbound.push({ ...imported, file });
    }
  }
}

const sortRecords = (left, right) => left.file.localeCompare(right.file) || left.kind.localeCompare(right.kind) || left.specifier.localeCompare(right.specifier) || left.line - right.line;
inbound.sort(sortRecords);
outbound.sort(sortRecords);
const inboundResult = compareAgainstBaseline(inbound, BASELINE.inbound);
const outboundResult = compareAgainstBaseline(outbound, BASELINE.outbound);
const additions = [
  ...inboundResult.additions.map((record) => ({ direction: "outside -> messages private", ...record })),
  ...outboundResult.additions.map((record) => ({ direction: "messages -> peer feature", ...record })),
];

console.log([
  "Messages boundary check:",
  "inbound=" + inbound.length + " (baseline " + BASELINE.inbound.length + ", removed " + inboundResult.removed + ")",
  "outbound=" + outbound.length + " (baseline " + BASELINE.outbound.length + ", removed " + outboundResult.removed + ")",
  "new=" + additions.length,
].join(" "));

if (additions.length > 0) {
  console.error("New messages boundary violations:");
  for (const item of additions) {
    console.error("- [" + item.direction + "] " + item.file + ":" + item.line + " " + item.kind + " " + JSON.stringify(item.specifier));
  }
  process.exitCode = 1;
}

