import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const distDir = path.resolve(process.argv[2] ?? "dist");
const assetsDir = path.join(distDir, "assets");
const workerAssetNames = (await readdir(assetsDir))
  .filter((name) => /^fastMarkdown\.worker-.*\.js$/.test(name));

if (workerAssetNames.length !== 1) {
  throw new Error(
    `Expected one production Fast Markdown Worker asset, found ${workerAssetNames.length}.`,
  );
}

const workerAssetPath = path.join(assetsDir, workerAssetNames[0]);
const workerSource = await readFile(workerAssetPath, "utf8");

if (/document\.createElement\((["'])i\1\)/.test(workerSource)) {
  throw new Error("Worker bundle contains the DOM-backed named character decoder.");
}
if (/\bnew DOMParser\b/.test(workerSource)) {
  throw new Error("Worker bundle contains the DOM-backed HTML parser entry.");
}
if (
  /\bwindow(?:\.|\[)/.test(workerSource) ||
  /\b(?:globalThis|self)\.(?:document|window)\b/.test(workerSource)
) {
  throw new Error("Worker bundle contains an explicit browser-global access.");
}

// KaTeX publishes dormant `toNode()` helpers that mention `document.*`, while
// rehype-katex's Worker path calls its string renderer. A blanket text scan for
// `document.` would therefore reject a safe bundle. The real smoke below keeps
// every DOM global absent and compiles math as well as HTML/entities, so an
// ordinary compile path that actually depends on those helpers fails here.

const wrapperSource = `
  import { parentPort } from "node:worker_threads";
  globalThis.self = globalThis;
  globalThis.addEventListener = (type, listener) => {
    if (type === "message") {
      parentPort.on("message", (data) => listener({ data }));
    }
  };
  globalThis.postMessage = (value) => parentPort.postMessage(value);
  await import(${JSON.stringify(pathToFileURL(workerAssetPath).href)});
  parentPort.postMessage({ type: "worker-ready" });
`;

const worker = new Worker(
  new URL(`data:text/javascript,${encodeURIComponent(wrapperSource)}`),
  { type: "module" },
);

try {
  await runSmoke(worker);
} finally {
  await worker.terminate();
}

async function runSmoke(workerInstance) {
  const requestId = "production-worker-smoke";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Production Fast Markdown Worker smoke timed out."));
    }, 15_000);

    workerInstance.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    workerInstance.on("message", (message) => {
      if (message?.type === "worker-ready") {
        workerInstance.postMessage({
          type: "compile-fast-markdown",
          requestId,
          requestMeta: {
            requestId,
            documentKey: "production-worker-smoke",
            contentHash: "smoke-content",
            optionsHash: "smoke-options",
            schemaVersion: "fast-markdown-worker-v1",
            createdAtMs: Date.now(),
          },
          args: {
            documentKey: "production-worker-smoke",
            rawMarkdown: [
              "# Worker smoke",
              "",
              "Copyright &copy;.",
              "",
              "<mark>Raw HTML survives structural parsing.</mark>",
              "",
              "Inline math: $x^2 + y^2$.",
            ].join("\n"),
            rendererProfile: "fast-html",
          },
        });
        return;
      }
      if (message?.requestId !== requestId) {
        return;
      }
      clearTimeout(timeout);
      if (message.type === "fast-markdown-error") {
        reject(new Error(`${message.error?.name}: ${message.error?.message}`));
        return;
      }
      const artifact = message.result;
      if (
        message.type !== "fast-markdown-result" ||
        artifact?.sanitization !== "main-thread-required" ||
        typeof artifact?.unsafeHtml !== "string" ||
        !artifact.unsafeHtml.includes("Worker smoke") ||
        !artifact.unsafeHtml.includes("©") ||
        !artifact.unsafeHtml.includes("<mark>") ||
        !artifact.unsafeHtml.includes("class=\"katex\"") ||
        Object.hasOwn(artifact, "html")
      ) {
        reject(new Error("Production Worker returned an invalid unsafe artifact."));
        return;
      }
      resolve();
    });
  });
}

console.log(
  `Fast Markdown production Worker smoke passed: ${workerAssetNames[0]}`,
);
