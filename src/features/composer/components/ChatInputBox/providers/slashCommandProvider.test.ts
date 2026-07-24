// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { slashCommandProvider } from './slashCommandProvider';

describe('slashCommandProvider', () => {
  it('returns local commands immediately without runtime bridge data', async () => {
    const results = await slashCommandProvider('', new AbortController().signal);

    expect(results).toEqual([
      expect.objectContaining({
        id: 'clear',
        label: '/clear',
        category: 'system',
      }),
    ]);
  });

  it('filters local commands by query', async () => {
    const signal = new AbortController().signal;

    await expect(slashCommandProvider('missing', signal)).resolves.toEqual([]);
    await expect(slashCommandProvider('clear', signal)).resolves.toHaveLength(1);
  });

  it('rejects an aborted request', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(slashCommandProvider('', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
