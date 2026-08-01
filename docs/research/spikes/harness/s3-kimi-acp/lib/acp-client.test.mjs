import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { resolveSandboxPath } from './acp-client.mjs';

test('resolveSandboxPath rejects traversal and symlink escape', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'mossx-acp-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'mossx-acp-outside-'));
  const canonicalRoot = realpathSync(root);
  context.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
  mkdirSync(join(root, 'inside'));
  writeFileSync(join(root, 'inside', 'ok.txt'), 'ok');
  writeFileSync(join(outside, 'secret.txt'), 'secret');
  symlinkSync(outside, join(root, 'escape'));

  assert.equal(
    resolveSandboxPath(root, 'inside/ok.txt'),
    join(canonicalRoot, 'inside', 'ok.txt'),
  );
  assert.equal(
    resolveSandboxPath(root, 'inside/new.txt', { allowMissing: true }),
    join(canonicalRoot, 'inside', 'new.txt'),
  );
  assert.throws(() => resolveSandboxPath(root, '../outside.txt'), /escapes/);
  assert.throws(() => resolveSandboxPath(root, 'escape/secret.txt'), /escapes/);
  assert.throws(
    () => resolveSandboxPath(root, 'escape/new.txt', { allowMissing: true }),
    /escapes/,
  );
});
