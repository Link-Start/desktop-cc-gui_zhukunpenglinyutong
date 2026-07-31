import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "@/types";
import {
  checkEmailInbox,
  claimNextEmailMailCommand,
  completeEmailMailCommand,
  getEmailInboundListenerStatus,
} from "@/services/tauri";

type UseMailDrivenSessionContinuationOptions = {
  activeWorkspace: WorkspaceInfo | null;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { skipPromptExpansion?: boolean },
  ) => Promise<unknown>;
  armMailDrivenCompletionEmail: (threadId: string, turnId?: string | null) => void;
};

const MAIL_COMMAND_POLL_INTERVAL_MS = 15_000;
const MIN_INBOX_CHECK_INTERVAL_MS = 10_000;

export function useMailDrivenSessionContinuation({
  activeWorkspace,
  sendUserMessageToThread,
  armMailDrivenCompletionEmail,
}: UseMailDrivenSessionContinuationOptions) {
  const processingRef = useRef(false);
  const lastInboxCheckAtRef = useRef(0);
  const inboxPollIntervalMsRef = useRef(MIN_INBOX_CHECK_INTERVAL_MS);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const checkInboxIfDue = async () => {
      const now = Date.now();
      const intervalMs = Math.max(
        MIN_INBOX_CHECK_INTERVAL_MS,
        inboxPollIntervalMsRef.current,
      );
      if (now - lastInboxCheckAtRef.current < intervalMs) {
        return;
      }
      lastInboxCheckAtRef.current = now;
      try {
        const status = await getEmailInboundListenerStatus();
        inboxPollIntervalMsRef.current = Math.max(
          MIN_INBOX_CHECK_INTERVAL_MS,
          status.pollingIntervalSeconds * 1000,
        );
        if (status.enabled) {
          await checkEmailInbox({});
        }
      } catch (error) {
        console.warn("[mail-session] failed to check email inbox", error);
      }
    };

    const poll = async () => {
      if (cancelled || processingRef.current) {
        return;
      }
      processingRef.current = true;
      try {
        await checkInboxIfDue();
        const result = await claimNextEmailMailCommand();
        const command = result.command;
        if (!command) {
          return;
        }
        if (!activeWorkspace || activeWorkspace.id !== command.workspaceId) {
          await completeEmailMailCommand({
            commandId: command.id,
            status: "needs_confirmation",
            rejectReason: "workspace_not_active",
          });
          return;
        }
        const instruction = command.detail?.trim();
        if (!instruction) {
          await completeEmailMailCommand({
            commandId: command.id,
            status: "needs_confirmation",
            rejectReason: "missing_command_detail",
          });
          return;
        }
        armMailDrivenCompletionEmail(command.threadId, null);
        try {
          await sendUserMessageToThread(activeWorkspace, command.threadId, instruction, [], {
            skipPromptExpansion: true,
          });
        } catch (sendError) {
          await completeEmailMailCommand({
            commandId: command.id,
            status: "needs_confirmation",
            rejectReason: "send_failed",
          });
          throw sendError;
        }
        await completeEmailMailCommand({
          commandId: command.id,
          status: "done",
        });
      } catch (error) {
        console.warn("[mail-session] failed to process queued email command", error);
      } finally {
        processingRef.current = false;
      }
    };

    const schedule = () => {
      if (cancelled) {
        return;
      }
      timer = window.setTimeout(() => {
        void poll().finally(schedule);
      }, MAIL_COMMAND_POLL_INTERVAL_MS);
    };

    void poll().finally(schedule);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [activeWorkspace, armMailDrivenCompletionEmail, sendUserMessageToThread]);
}
