// Probe 5: model selection 边界（0 次模型调用）
// A) session/new 传 model 字段是否生效（对比 currentValue）
// B) session/set_model 是否存在并生效
// C) session/set_config_option 改 model 是否生效
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const transcriptPath = new URL('../evidence/probe5-model.transcript.ndjson', import.meta.url).pathname;

const client = spawnAcp({ cwd: CWD, transcriptPath });
client.onNotification((msg) => {
  if (msg.method === 'session/update' && msg.params?.update?.sessionUpdate === 'config_option_update') {
    console.log('[config_option_update]', JSON.stringify(msg.params.update).slice(0, 400));
  }
});

const currentModel = (r) =>
  r?.configOptions?.find((o) => o.id === 'model')?.currentValue;

await client.request('initialize', initializeParams());

// A) session/new with model
const sA = await client.request('session/new', { cwd: CWD, mcpServers: [], model: 'kimi-code/kimi-for-coding' });
console.log('A) session/new(model=kimi-for-coding) currentValue =', currentModel(sA), '| sessionId =', sA.sessionId);

// B) session/set_model
try {
  const rB = await client.request('session/set_model', { sessionId: sA.sessionId, modelId: 'kimi-code/kimi-for-coding-highspeed' });
  console.log('B) session/set_model result:', JSON.stringify(rB));
} catch (e) {
  console.log('B) session/set_model ERROR:', e.message);
}

// C) session/set_config_option
try {
  const rC = await client.request('session/set_config_option', {
    sessionId: sA.sessionId,
    configId: 'model',
    value: 'kimi-code/kimi-for-coding',
  });
  console.log('C) session/set_config_option result:', JSON.stringify(rC)?.slice(0, 400));
} catch (e) {
  console.log('C) session/set_config_option ERROR:', e.message);
}

client.close();
setTimeout(() => process.exit(0), 500);
