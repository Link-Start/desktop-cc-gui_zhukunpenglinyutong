import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Preserves readable React component names in production bundles so the bundled
// react-scan overlay can attribute renders to real names (e.g. MessagesTimeline)
// instead of minified identifiers. It suppresses name minification and inflates
// the bundle, so it is opt-in: only profiling builds (VITE_ENABLE_REACT_SCAN=1)
// pay for it; regular release builds ship fully minified names.
import reactComponentName from "react-scan/react-component-name/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build" && process.env.VITE_ENABLE_REACT_SCAN === "1"
      ? [reactComponentName({}) as PluginOption]
      : []),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/commands",
      "@codemirror/autocomplete",
      "@codemirror/lint",
      "@codemirror/search",
    ],
  },
  worker: {
    format: "es",
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite/Rollup 的共享 helper 虚拟模块不带 node_modules 路径，默认并进
          // 「首个使用者」chunk；一旦落进 vendor-mermaid / vendor-docs，入口会静态
          // 依赖这些重 chunk，把懒加载全部击穿。钉进常驻小 chunk（不要用 \0 全量
          // 兜底：commonjs 代理模块也带 \0 前缀，会把真实代码扫进来并造成循环 chunk）。
          if (id === "\0vite/preload-helper.js" || id === "\0commonjsHelpers.js")
            return "vendor-shared";
          if (!id.includes("node_modules")) return;
          if (id.includes("/react-dom/") || /\/react\//.test(id) || id.includes("scheduler"))
            return "vendor-react";
          if (id.includes("@codemirror/") || id.includes("@lezer/")) return "vendor-codemirror";
          if (id.includes("@tauri-apps/")) return "vendor-tauri";
          // Pure markdown parsing chains (no React deps) — keeps vendor-react acyclic
          if (id.includes("/katex/") || id.includes("micromark") ||
              id.includes("mdast-") || id.includes("hast-") || id.includes("unist-") ||
              id.includes("remark-") || id.includes("rehype-"))
            return "vendor-markdown";
          // dompurify 被启动路径静态引用，又被 mermaid 依赖；不单独分包时 Rollup 会把
          // 它并进 vendor-mermaid，导致 2.3MB 的 mermaid 变成启动即加载。
          if (id.includes("/dompurify/")) return "vendor-sanitize";
          if (id.includes("/mermaid/")) return "vendor-mermaid";
          if (id.includes("/viewerjs/") || id.includes("/viewerjs-")) return "vendor-mermaid";
          if (id.includes("/pdfjs-dist/") || id.includes("/mammoth/") || id.includes("/xlsx/"))
            return "vendor-docs";
          if (id.includes("/lucide-react/"))
            return "vendor-ui-heavy";
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/vitest.setup.ts"],
    maxWorkers: 2,
    minWorkers: 1,
    deps: {
      optimizer: {
        web: {
          include: ["react-i18next"],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**", "**/.codex-worktrees/**"],
    },
  },
}));
