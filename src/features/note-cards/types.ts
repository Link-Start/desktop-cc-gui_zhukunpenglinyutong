import type { WorkspaceNoteCardSource } from "../../services/tauri";

export type NoteCaptureDraft = {
  title: string;
  bodyMarkdown: string;
  source: WorkspaceNoteCardSource;
};

export type WorkspaceNoteCaptureRequest = {
  requestId: number;
  draft: NoteCaptureDraft;
};
