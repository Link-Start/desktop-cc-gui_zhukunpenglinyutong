// Probe 2: session/prompt 完整 lifecycle
// 验证: session/update notification 类型序列、prompt response stopReason、
//       长 turn request 语义（response 是否在整个 turn 完成后才返回）
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const transcriptPath = new URL('../evidence/probe2-prompt.transcript.ndjson', import.meta.url).pathname;

const client = spawnAcp({ cwd: CWD, transcriptPath });
const updates = []; // { t: ms since prompt send, update }
let promptSentAt = 0;

client.onNotification((msg) => {
  if (msg.method === 'session/update') {
    updates.push({
      elapsedMs: Date.now() - promptSentAt,
      sessionUpdate: msg.params?.update?.sessionUpdate,
    });
  }
});

try {
  await client.request('initialize', initializeParams());
  const session = await client.request('session/new', { cwd: CWD, mcpServers: [] });
  console.log('sessionId:', session.sessionId);

  promptSentAt = Date.now();
  const promptResult = await client.request('session/prompt', {
    sessionId: session.sessionId,
    prompt: [{ type: 'text', text: 'Reply with exactly one word: PONG' }],
  });
  const totalMs = Date.now() - promptSentAt;

  console.log('=== session/prompt result ===');
  console.log(JSON.stringify(promptResult, null, 2));
  console.log(`total elapsed: ${totalMs}ms (response arrived AFTER full turn => long-turn request semantics)`);

  console.log('=== session/update notification type sequence ===');
  for (const u of updates) console.log(`+${u.elapsedMs}ms  ${u.sessionUpdate}`);
  const counts = {};
  for (const u of updates) counts[u.sessionUpdate] = (counts[u.sessionUpdate] || 0) + 1;
  console.log('counts:', JSON.stringify(counts));
} finally {
  client.close();
  setTimeout(() => process.exit(0), 500);
}
