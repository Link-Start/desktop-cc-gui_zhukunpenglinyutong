#!/usr/bin/env node
/**
 * S1 Spike Harness: codex app-server `thread/inject_items` 实测
 *
 * 用途: 通过 stdio JSON-RPC 驱动 `codex app-server`，验证 thread/inject_items 能力。
 * 协议: newline-delimited JSON-RPC 2.0（每行一个 JSON 对象）。
 *
 * 用法:
 *   node harness.mjs probe          # initialize + thread/start + 注入1条 user message + thread/read
 *   node harness.mjs types          # 注入 message(user/assistant)/function_call/function_call_output/reasoning
 *   node harness.mjs dup            # 重复注入同一 item（相同 id）观察行为
 *   node harness.mjs badmethod      # 调用不存在的方法名，采集错误格式
 *   node harness.mjs canary         # 注入独特事实后 turn/start，验证模型是否"看到"（消耗 1 次 API 调用）
 *   node harness.mjs resume <id>    # thread/resume + thread/read 验证持久化 read-back
 *
 * 所有 raw request/response 追加写入 transcript 文件（ evidence/ 目录）。
 * thread 的 cwd 固定为 /tmp/mossx-s1-spike/workdir，避免污染真实工作区。
 */

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

const CODEX_BIN = process.env.CODEX_BIN ?? 'codex';
const WORKDIR = '/tmp/mossx-s1-spike/workdir';
const EVIDENCE_DIR = '/tmp/mossx-s1-spike/evidence';

mkdirSync(WORKDIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const phase = process.argv[2] ?? 'probe';
const phaseArg = process.argv[3];
const transcriptPath = path.join(EVIDENCE_DIR, `transcript-${phase}-${Date.now()}.jsonl`);
const transcript = createWriteStream(transcriptPath, { flags: 'a' });

let nextId = 1;
const pending = new Map(); // id -> {resolve, reject, timer}
const notifications = [];  // 收集 server notification，最后摘要输出

function log(direction, obj) {
  transcript.write(JSON.stringify({ t: new Date().toISOString(), dir: direction, msg: obj }) + '\n');
}

const child = spawn(CODEX_BIN, ['app-server', '--listen', 'stdio://'], {
  cwd: WORKDIR,
  stdio: ['pipe', 'pipe', 'inherit'], // stderr 直通终端便于观察
});

child.on('error', (err) => { console.error('spawn failed:', err); process.exit(1); });

const rl = createInterface({ input: child.stdout });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { console.error('[non-json stdout]', line); return; }
  log('recv', msg);
  if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
    const entry = pending.get(String(msg.id));
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(String(msg.id));
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    }
  } else {
    notifications.push(msg);
  }
});

function send(obj) { log('send', obj); child.stdin.write(JSON.stringify(obj) + '\n'); }

function request(method, params, timeoutMs = 30000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(String(id));
      reject(new Error(`timeout waiting for ${method} (id=${id})`));
    }, timeoutMs);
    pending.set(String(id), { resolve, reject, timer });
    send({ jsonrpc: '2.0', id, method, params });
  });
}

function notify(method, params) { send({ jsonrpc: '2.0', method, params }); }

async function initSession() {
  const initRes = await request('initialize', {
    clientInfo: { name: 'mossx-s1-spike', title: 'mossx S1 spike harness', version: '0.1.0' },
    capabilities: { experimentalApi: true, requestAttestation: false },
  });
  console.log('== initialize result:', JSON.stringify(initRes).slice(0, 500));
  notify('initialized', {});
  return initRes;
}

async function startThread() {
  const res = await request('thread/start', {
    cwd: WORKDIR,
    approvalPolicy: 'never',
    sandbox: 'read-only',
    ephemeral: false,
  });
  const thread = res.thread ?? res;
  console.log('== thread/start id:', thread.id);
  console.log('== thread keys:', Object.keys(thread).join(','));
  return thread;
}

async function readThread(threadId) {
  const res = await request('thread/read', { threadId, includeTurns: true });
  return res.thread ?? res;
}

function summarizeItems(thread, label) {
  const turns = thread.turns ?? [];
  console.log(`== ${label}: turns=${turns.length}`);
  for (const turn of turns) {
    const items = turn.items ?? [];
    for (const item of items) {
      console.log(`   turn=${turn.id} item.type=${item.type} id=${item.id ?? '(none)'} keys=${Object.keys(item).join('|')}`);
    }
  }
}

async function shutdown(code) {
  console.log(`== notifications received: ${notifications.length}`);
  for (const n of notifications.slice(0, 30)) {
    console.log('   [ntf]', n.method ?? '(response-like)', JSON.stringify(n.params ?? {}).slice(0, 200));
  }
  console.log('== transcript:', transcriptPath);
  transcript.end();
  child.kill('SIGTERM');
  // 给 rollout flush 留时间
  setTimeout(() => process.exit(code), 800);
}

// ---------- phases ----------

async function phaseProbe() {
  await initSession();
  const thread = await startThread();
  const injectRes = await request('thread/inject_items', {
    threadId: thread.id,
    items: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'PROBE_HELLO_001 这是探测注入。' }] }],
  });
  console.log('== inject result:', JSON.stringify(injectRes));
  const read = await readThread(thread.id);
  summarizeItems(read, 'after inject');
  console.log('THREAD_ID=' + thread.id);
}

async function phaseTypes() {
  await initSession();
  const thread = await startThread();
  const callId = 'call_s1spike_0001';
  const items = [
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'TYPES_USER_001 用户输入文本。' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'TYPES_ASSISTANT_001 助手输出文本。' }] },
    { type: 'function_call', name: 'get_weather', arguments: '{"city":"Shanghai"}', call_id: callId },
    { type: 'function_call_output', call_id: callId, output: '{"temperature":"26C"}' },
    { type: 'reasoning', summary: [{ type: 'summary_text', text: 'TYPES_REASONING_001 推理摘要。' }], content: [{ type: 'reasoning_text', text: '内部推理内容。' }], encrypted_content: null },
  ];
  // 逐条注入，分别观察是否报错（定位不支持的类型）
  for (const item of items) {
    try {
      const res = await request('thread/inject_items', { threadId: thread.id, items: [item] });
      console.log(`== inject OK type=${item.type}:`, JSON.stringify(res));
    } catch (e) {
      console.log(`== inject FAIL type=${item.type}:`, e.message);
    }
  }
  const read = await readThread(thread.id);
  summarizeItems(read, 'after types inject');
  console.log('THREAD_ID=' + thread.id);
}

async function phaseDup() {
  await initSession();
  const thread = await startThread();
  const item = { type: 'message', id: 'msg_s1spike_dup_001', role: 'user', content: [{ type: 'input_text', text: 'DUP_001 重复注入测试。' }] };
  for (let i = 1; i <= 2; i++) {
    try {
      const res = await request('thread/inject_items', { threadId: thread.id, items: [item] });
      console.log(`== inject #${i} OK:`, JSON.stringify(res));
    } catch (e) {
      console.log(`== inject #${i} FAIL:`, e.message);
    }
  }
  // 对照组：不带 id 注入两次
  const noId = { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'DUP_NOID_001 无 id 重复注入。' }] };
  for (let i = 1; i <= 2; i++) {
    try {
      await request('thread/inject_items', { threadId: thread.id, items: [noId] });
      console.log(`== inject(no-id) #${i} OK`);
    } catch (e) {
      console.log(`== inject(no-id) #${i} FAIL:`, e.message);
    }
  }
  const read = await readThread(thread.id);
  summarizeItems(read, 'after dup inject');
  console.log('THREAD_ID=' + thread.id);
}

async function phaseBadMethod() {
  await initSession();
  const thread = await startThread();
  for (const m of ['thread/injectItems', 'thread/inject_item', 'thread/append_items']) {
    try {
      const res = await request(m, { threadId: thread.id, items: [] });
      console.log(`== ${m} OK:`, JSON.stringify(res));
    } catch (e) {
      console.log(`== ${m} FAIL:`, e.message);
    }
  }
  // 参数缺失/非法的错误格式
  try {
    await request('thread/inject_items', { threadId: thread.id });
  } catch (e) {
    console.log('== missing items param FAIL:', e.message);
  }
  try {
    await request('thread/inject_items', { threadId: 'nonexistent-thread-id', items: [] });
  } catch (e) {
    console.log('== bad threadId FAIL:', e.message);
  }
  console.log('THREAD_ID=' + thread.id);
}

async function phaseCanary() {
  await initSession();
  const thread = await startThread();
  // 注入一个模型不可能知道的事实
  await request('thread/inject_items', {
    threadId: thread.id,
    items: [
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: '请记住这个事实：MOSSX_CANARY_7F3A 是一个数字，它的值是 42。' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '好的，我已经记住 MOSSX_CANARY_7F3A 的值是 42。' }] },
    ],
  });
  console.log('== canary facts injected');
  const turnRes = await request('turn/start', {
    threadId: thread.id,
    clientUserMessageId: 'cum_s1spike_canary_001',
    input: [{ type: 'text', text: 'MOSSX_CANARY_7F3A 的值是多少？只回答数字本身，不要任何其他内容。', text_elements: [] }],
    approvalPolicy: 'never',
    sandboxPolicy: { type: 'readOnly', networkAccess: false },
  }, 120000);
  const turn = turnRes.turn ?? turnRes;
  console.log('== turn started id:', turn.id, 'status:', turn.status);
  // 等待 turn/completed 通知
  const completed = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('turn completion timeout')), 180000);
    const check = setInterval(() => {
      const hit = notifications.find((n) => n.method === 'turn/completed' && n.params?.turn?.id === turn.id);
      if (hit) { clearInterval(check); clearTimeout(timer); resolve(hit.params); }
    }, 500);
  });
  console.log('== turn completed status:', completed.turn?.status);
  const lastItems = completed.turn?.items ?? [];
  for (const it of lastItems) {
    if (it.type === 'agentMessage' || it.type === 'message') {
      console.log('== assistant says:', JSON.stringify(it).slice(0, 400));
    }
  }
  console.log('THREAD_ID=' + thread.id);
}

async function phaseResume(threadId) {
  await initSession();
  const res = await request('thread/resume', { threadId, approvalPolicy: 'never', sandbox: 'read-only' });
  const thread = res.thread ?? res;
  console.log('== resumed thread id:', thread.id);
  const read = await readThread(thread.id);
  summarizeItems(read, 'after resume');
  console.log('THREAD_ID=' + thread.id);
}

// ---------- main ----------

const phases = {
  probe: phaseProbe,
  types: phaseTypes,
  dup: phaseDup,
  badmethod: phaseBadMethod,
  canary: phaseCanary,
  resume: () => phaseResume(phaseArg),
};

(async () => {
  const fn = phases[phase];
  if (!fn) { console.error('unknown phase:', phase); process.exit(2); }
  try {
    await fn();
    await shutdown(0);
  } catch (e) {
    console.error('== PHASE ERROR:', e.message);
    await shutdown(1);
  }
})();
