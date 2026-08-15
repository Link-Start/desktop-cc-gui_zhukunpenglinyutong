import type { ThreadDeleteErrorCode } from "../threads/hooks/useThreads";

export type WorkspaceHomeDeleteResult = {
  succeededThreadIds: string[];
  failed: Array<{
    threadId: string;
    code: ThreadDeleteErrorCode;
    message: string;
  }>;
};
