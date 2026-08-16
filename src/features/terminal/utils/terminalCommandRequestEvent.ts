export interface TerminalCommandRequest {
  terminalId: string;
  title: string;
  command: string;
  followUpCommand?: string;
  followUpDelayMs?: number;
}

export const TERMINAL_COMMAND_REQUEST_EVENT = "mossx:terminal-command-request";

export function requestTerminalCommand(detail: TerminalCommandRequest): void {
  document.dispatchEvent(
    new CustomEvent<TerminalCommandRequest>(TERMINAL_COMMAND_REQUEST_EVENT, {
      detail,
    }),
  );
}
