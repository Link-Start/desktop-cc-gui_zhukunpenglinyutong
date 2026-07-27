// Probe 1: initialize 握手 + session/new
// 验证: protocol version 协商、agent capabilities 全字段、session/new 响应 shape
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const transcriptPath = new URL('../evidence/probe1-initialize.transcript.ndjson', import.meta.url).pathname;

const client = spawnAcp({ cwd: CWD, transcriptPath });

try {
  const init = await client.request('initialize', initializeParams());
  console.log('=== initialize result ===');
  console.log(JSON.stringify(init, null, 2));

  const session = await client.request('session/new', { cwd: CWD, mcpServers: [] });
  console.log('=== session/new result ===');
  console.log(JSON.stringify(session, null, 2));

  // 顺带探测 session/new 是否接受 model 字段（Q6 model selection 边界）
  try {
    const withModel = await client.request('session/new', {
      cwd: CWD,
      mcpServers: [],
      model: 'kimi-code/k3',
    });
    console.log('=== session/new with model param result ===');
    console.log(JSON.stringify(withModel, null, 2));
  } catch (e) {
    console.log('=== session/new with model param ERROR ===', e.message);
  }
} finally {
  client.close();
  setTimeout(() => process.exit(0), 500);
}
