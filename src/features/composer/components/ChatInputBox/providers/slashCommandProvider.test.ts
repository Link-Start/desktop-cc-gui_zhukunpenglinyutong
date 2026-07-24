// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetSlashCommandsState,
  setupSlashCommandsCallback,
  slashCommandProvider,
} from './slashCommandProvider';

type SlashCommandWindow = Window & {
  updateSlashCommands?: (json: string) => void;
  __pendingSlashCommands?: string;
};

function slashCommandWindow(): SlashCommandWindow {
  return window as SlashCommandWindow;
}

describe('slashCommandProvider', () => {
  beforeEach(() => {
    resetSlashCommandsState();
    delete slashCommandWindow().updateSlashCommands;
    delete slashCommandWindow().__pendingSlashCommands;
  });

  afterEach(() => {
    resetSlashCommandsState();
  });

  it('normalizes mixed SDK command payloads and skips malformed entries', async () => {
    slashCommandWindow().__pendingSlashCommands = JSON.stringify([
      { name: '/review', description: 'Review changes' },
      { name: 42, description: 'bad name' },
      'workflow-run',
      '',
      null,
      { name: 'workflow-run', description: 'duplicate' },
    ]);
    setupSlashCommandsCallback();

    const results = await slashCommandProvider('', new AbortController().signal);
    const labels = results.map((item) => item.label);

    expect(labels).toContain('/clear');
    expect(labels).toContain('/review');
    expect(labels).toContain('/workflow-run');
    expect(labels.filter((label) => label === '/workflow-run')).toHaveLength(1);
    expect(labels).not.toContain('/');
  });

  it('keeps slash completion usable when SDK payload contains only malformed entries', async () => {
    slashCommandWindow().__pendingSlashCommands = JSON.stringify([
      { name: 42 },
      false,
      null,
      { description: 'missing name' },
    ]);
    setupSlashCommandsCallback();

    const results = await slashCommandProvider('', new AbortController().signal);

    expect(results).toEqual([
      expect.objectContaining({
        id: 'clear',
        label: '/clear',
        category: 'system',
      }),
    ]);
  });
});
