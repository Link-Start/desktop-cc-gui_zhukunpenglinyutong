// Probe 3c: 交叉验证 replay fidelity
// 对 probe2 的纯文本 session（无 tool call）执行 session/load，
// 确认 agent_message 缺失是否与 tool-call turn 相关，还是普遍行为。
import { writeFileSync } from 'node:fs';
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const dir = new URL('../evidence/', import.meta.url).pathname;
const sessionId = process.argv[2];
if (!sessionId) {
  console.error('usage: node probe3c-load-text-session.mjs <sessionId>');
  process.exit(1);
}

const updates = [];
const client = spawnAcp({ cwd: CWD, transcriptPath: `${dir}probe3c-load-${sessionId}.transcript.ndjson` });
client.onNotification((msg) => {
  if (msg.method === 'session/update') updates.push(msg.params.update);
});

await client.request('initialize', initializeParams());
const loadResult = await client.request('session/load', { sessionId, cwd: CWD, mcpServers: [] });
console.log('load ok, configOptions count:', loadResult?.configOptions?.length);
await new Promise((r) => setTimeout(r, 2000));
for (const u of updates) {
  console.log(u.sessionUpdate, '=>', JSON.stringify(u).slice(0, 300));
}
writeFileSync(`${dir}probe3c-replay-${sessionId}.json`, JSON.stringify(updates, null, 2));
client.close();
setTimeout(() => process.exit(0), 500);
