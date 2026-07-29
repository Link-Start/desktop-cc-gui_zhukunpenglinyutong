// Probe 6: session/list + session/resume（0 次模型调用）
// sessionCapabilities 广告了 list/resume，验证其真实响应 shape；
// 并对比 session/resume 与 session/load 的 replay 行为是否一致。
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const transcriptPath = new URL('../evidence/probe6-list-resume.transcript.ndjson', import.meta.url).pathname;
const targetSession = process.argv[2];
if (!targetSession) {
  throw new Error('usage: node probe6-list-resume.mjs <session-id>');
}

const client = spawnAcp({ cwd: CWD, transcriptPath });
const updates = [];
client.onNotification((msg) => {
  if (msg.method === 'session/update') updates.push(msg.params.update?.sessionUpdate);
});

await client.request('initialize', initializeParams());

try {
  const list = await client.request('session/list', { cwd: CWD });
  console.log('=== session/list (truncated) ===');
  const s = JSON.stringify(list);
  console.log(s.slice(0, 800));
  console.log(`... total ${s.length} bytes`);
} catch (e) {
  console.log('session/list ERROR:', e.message);
}

try {
  const r = await client.request('session/resume', { sessionId: targetSession, cwd: CWD, mcpServers: [] });
  console.log('=== session/resume result ===', JSON.stringify(r)?.slice(0, 300));
  await new Promise((res) => setTimeout(res, 2000));
  console.log('resume replay update types:', JSON.stringify(updates));
} catch (e) {
  console.log('session/resume ERROR:', e.message);
}

client.close();
setTimeout(() => process.exit(0), 500);
