/**
 * Compatibility entry for existing callers.
 *
 * New production code imports `FileMarkdownPreview` from `./FileMarkdownPreviewRouter`.
 */
export {
  FileMarkdownPreview as FileMarkdownPreviewFast,
} from "./FileMarkdownPreviewRouter";
export type {
  FileMarkdownPreviewProps as FileMarkdownPreviewFastProps,
} from "./FileMarkdownPreviewRouter";
