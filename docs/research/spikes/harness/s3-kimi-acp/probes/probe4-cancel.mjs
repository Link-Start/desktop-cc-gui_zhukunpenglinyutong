// Probe 4: session/cancel 取消语义
// 发一个长输出 prompt，收到第一个 agent chunk 后发送 session/cancel notification，
// 观察 prompt request 的 response（stopReason 预期 "cancelled"）与后续 notification。
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const transcriptPath = new URL('../evidence/probe4-cancel.transcript.ndjson', import.meta.url).pathname;

const client = spawnAcp({ cwd: CWD, transcriptPath });
let firstChunkAt = 0;
let cancelled = false;
const updatesAfterCancel = [];

await client.request('initialize', initializeParams());
const session = await client.request('session/new', { cwd: CWD, mcpServers: [] });
const sessionId = session.sessionId;

client.onNotification((msg) => {
  if (msg.method !== 'session/update') return;
  const kind = msg.params?.update?.sessionUpdate;
  if (!firstChunkAt && (kind === 'agent_message_chunk' || kind === 'agent_thought_chunk')) {
    firstChunkAt = Date.now();
    console.log('first chunk received, sending session/cancel ...');
    client.notify('session/cancel', { sessionId });
    cancelled = true;
  } else if (cancelled) {
    updatesAfterCancel.push(kind);
  }
});

const t0 = Date.now();
const result = await client.request('session/prompt', {
  sessionId,
  prompt: [
    { type: 'text', text: 'Count from 1 to 200, one number per line. Do not use any tools.' },
  ],
});
console.log(`prompt returned after ${Date.now() - t0}ms`);
console.log('=== result ===', JSON.stringify(result));
console.log('updates observed after cancel:', JSON.stringify(updatesAfterCancel));
client.close();
setTimeout(() => process.exit(0), 500);
