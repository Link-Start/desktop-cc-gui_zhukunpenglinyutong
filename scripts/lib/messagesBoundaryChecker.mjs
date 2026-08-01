import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }
  return files;
}

function getScriptKind(file) {
  switch (path.extname(file)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.JS;
  }
}

function collectImports(file) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file),
  );
  const imports = [];
  const add = (kind, node, literal) => imports.push({
    kind,
    specifier: literal.text,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
  });

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add("import", node, node.moduleSpecifier);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      add("export", node, node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      add("import-type", node, node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const expression = node.expression;
      if (expression.kind === ts.SyntaxKind.ImportKeyword) {
        add("dynamic-import", node, node.arguments[0]);
      } else if (ts.isIdentifier(expression) && expression.text === "require") {
        add("require", node, node.arguments[0]);
      } else if (
        ts.isPropertyAccessExpression(expression) &&
        expression.name.text === "mock" &&
        ts.isIdentifier(expression.expression) &&
        ["vi", "jest"].includes(expression.expression.text)
      ) {
        add("mock", node, node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function isInside(candidate, directory) {
  return candidate === directory || candidate.startsWith(directory + path.sep);
}

function resolveTarget(file, specifier, srcRoot) {
  if (specifier.startsWith("@/")) {
    return path.join(srcRoot, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(file), specifier);
  }
  return null;
}

export function canonicalMessagesBoundaryKey(record) {
  return [record.file, record.kind, record.specifier].join("|");
}

function compareAgainstBaseline(records, baseline) {
  const remaining = new Map();
  for (const item of baseline) {
    remaining.set(item, (remaining.get(item) ?? 0) + 1);
  }
  const additions = [];
  for (const record of records) {
    const key = canonicalMessagesBoundaryKey(record);
    const allowed = remaining.get(key) ?? 0;
    if (allowed > 0) {
      remaining.set(key, allowed - 1);
    } else {
      additions.push(record);
    }
  }
  const removed = [...remaining.values()].reduce((total, count) => total + count, 0);
  return { additions, removed };
}

function isComponentPath(target, repoRoot) {
  return path
    .relative(repoRoot, target)
    .split(path.sep)
    .includes("components");
}

function sortRecords(left, right) {
  return (
    left.file.localeCompare(right.file) ||
    left.kind.localeCompare(right.kind) ||
    left.specifier.localeCompare(right.specifier) ||
    left.line - right.line
  );
}

function dedupeViolations(violations) {
  const seen = new Set();
  return violations.filter((violation) => {
    const key = [
      violation.direction,
      violation.file,
      violation.kind,
      violation.specifier,
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function analyzeMessagesBoundaries({
  repoRoot,
  baseline = { inbound: [], outbound: [] },
}) {
  const srcRoot = path.join(repoRoot, "src");
  const featuresRoot = path.join(srcRoot, "features");
  const messagesRoot = path.join(featuresRoot, "messages");
  const threadsRoot = path.join(featuresRoot, "threads");
  const rowsRoot = path.join(messagesRoot, "rows");
  const timelineRoot = path.join(messagesRoot, "timeline");
  const orchestrationRoot = path.join(messagesRoot, "orchestration");
  const pureTimelineRoots = [
    path.join(timelineRoot, "projection"),
    path.join(timelineRoot, "virtualization"),
  ];
  const messagesPublicTargets = new Set([
    messagesRoot,
    path.join(messagesRoot, "index"),
    path.join(messagesRoot, "index.ts"),
  ]);
  const threadsForbiddenTargets = [
    "components",
    "utils",
    "rendering",
    "rows",
    "timeline",
    "orchestration",
  ].map((segment) => path.join(messagesRoot, segment));
  const inbound = [];
  const outbound = [];
  const structuralViolations = [];

  for (const absoluteFile of walk(srcRoot)) {
    const sourceIsMessages = isInside(absoluteFile, messagesRoot);
    const sourceIsThreads = isInside(absoluteFile, threadsRoot);
    const sourceIsRows = isInside(absoluteFile, rowsRoot);
    const sourceIsPureTimeline = pureTimelineRoots.some((root) =>
      isInside(absoluteFile, root),
    );
    const file = path.relative(repoRoot, absoluteFile).split(path.sep).join("/");
    for (const imported of collectImports(absoluteFile)) {
      const target = resolveTarget(absoluteFile, imported.specifier, srcRoot);
      if (!target) {
        continue;
      }
      const record = { ...imported, file };
      const targetIsMessagesPrivate =
        isInside(target, messagesRoot) && !messagesPublicTargets.has(target);
      if (!sourceIsMessages && targetIsMessagesPrivate) {
        inbound.push(record);
        const direction =
          sourceIsThreads && threadsForbiddenTargets.some((root) => isInside(target, root))
            ? "threads -> messages private"
            : "outside -> messages private";
        structuralViolations.push({ direction, ...record });
      }
      if (sourceIsMessages && isInside(target, featuresRoot) && !isInside(target, messagesRoot)) {
        outbound.push(record);
      }
      if (
        sourceIsRows &&
        (isInside(target, timelineRoot) || isInside(target, orchestrationRoot))
      ) {
        structuralViolations.push({
          direction: "messages rows -> controller owner",
          ...record,
        });
      }
      if (sourceIsPureTimeline && isComponentPath(target, repoRoot)) {
        structuralViolations.push({
          direction: "pure timeline -> React components",
          ...record,
        });
      }
    }
  }

  inbound.sort(sortRecords);
  outbound.sort(sortRecords);
  structuralViolations.sort(sortRecords);
  const inboundResult = compareAgainstBaseline(inbound, baseline.inbound);
  const outboundResult = compareAgainstBaseline(outbound, baseline.outbound);
  const violations = dedupeViolations([
    ...structuralViolations,
    ...outboundResult.additions.map((record) => ({
      direction: "messages -> peer feature",
      ...record,
    })),
  ]);

  return {
    inbound,
    outbound,
    inboundRemoved: inboundResult.removed,
    outboundRemoved: outboundResult.removed,
    violations,
  };
}

export function formatMessagesBoundaryReport(report, baseline) {
  const lines = [
    [
      "Messages boundary check:",
      `inbound=${report.inbound.length} (baseline ${baseline.inbound.length}, removed ${report.inboundRemoved})`,
      `outbound=${report.outbound.length} (baseline ${baseline.outbound.length}, removed ${report.outboundRemoved})`,
      `new=${report.violations.length}`,
    ].join(" "),
  ];
  if (report.violations.length > 0) {
    lines.push("Messages boundary violations:");
    for (const item of report.violations) {
      lines.push(
        `- [${item.direction}] ${item.file}:${item.line} ${item.kind} ${JSON.stringify(item.specifier)}`,
      );
    }
  }
  return lines.join("\n");
}
