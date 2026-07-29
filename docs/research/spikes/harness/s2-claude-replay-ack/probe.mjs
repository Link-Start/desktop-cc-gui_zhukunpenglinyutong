#!/usr/bin/env node
/**
 * S2 Spike harness — 实测 Claude Code 2.1.218 `--replay-user-messages` ACK 语义。
 *
 * 用法:
 *   node probe.mjs <scenario> [--no-replay]
 *
 * scenario:
 *   single   - 发送一条带唯一 marker 的 user message，发送后立即关闭 stdin
 *   long     - 发送一条 >4KB 多行 user message，验证 echo 是否逐字保留
 *   two      - 保持 stdin 打开，第一条 result 到达后再发第二条，验证双 echo 与顺序
 *   badflag  - 用非法 flag 触发启动失败，观察 exit code 与 result event 的对应关系（不耗 API）
 *
 * 输出:
 *   - stdout: 逐事件摘要（索引、type、关键字段）
 *   - evidence/<scenario>-<ts>.ndjson: 原始 NDJSON transcript（含 stdin 方向记录，以 "> " 前缀区分）
 *   - evidence/<scenario>-<ts>.meta.json: exit code / signal / 是否收到 result / 耗时
 *
 * 环境约束: 实验 cwd 固定在 /tmp/mossx-s2-spike，不污染真实工作区。
 */

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
const PROBE_CWD = '/tmp/mossx-s2-spike';
const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = join(HERE, 'evidence');
mkdirSync(EVIDENCE_DIR, { recursive: true });
mkdirSync(PROBE_CWD, { recursive: true });

const scenario = process.argv[2] ?? 'single';
const noReplay = process.argv.includes('--no-replay');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const transcriptPath = join(EVIDENCE_DIR, `${scenario}${noReplay ? '-noreplay' : ''}-${ts}.ndjson`);
const metaPath = join(EVIDENCE_DIR, `${scenario}${noReplay ? '-noreplay' : ''}-${ts}.meta.json`);
const transcript = createWriteStream(transcriptPath);

const MARKER = 'MOSSX_S2_PROBE_7f3a9c';
const RESULT_TIMEOUT_MS = 180_000;

/** 构造 stream-json input 的 user message 行 */
function userMsg(content) {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
  });
}

function buildArgs() {
  if (scenario === 'badflag') {
    // 非法 flag 触发启动失败；不发起任何 API 调用
    return ['-p', '--definitely-not-a-real-flag-xyz'];
  }
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
  ];
  if (!noReplay) args.push('--replay-user-messages');
  return args;
}

const args = buildArgs();
console.log(`[harness] scenario=${scenario} noReplay=${noReplay}`);
console.log(`[harness] spawn: ${CLAUDE} ${args.join(' ')}  (cwd=${PROBE_CWD})`);

const child = spawn(CLAUDE, args, {
  cwd: PROBE_CWD,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

const events = []; // { index, atMs, parsed }
let stdoutBuf = '';
let stderrBuf = '';
let resultEvent = null;
const t0 = Date.now();

child.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString('utf8');
  let nl;
  while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, nl);
    stdoutBuf = stdoutBuf.slice(nl + 1);
    if (!line.trim()) continue;
    transcript.write(line + '\n');
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.log(`[event ${events.length}] (non-JSON) ${line.slice(0, 200)}`);
      events.push({ index: events.length, atMs: Date.now() - t0, parsed: null, raw: line });
      continue;
    }
    const idx = events.length;
    events.push({ index: idx, atMs: Date.now() - t0, parsed });
    const type = parsed.type;
    const subtype = parsed.subtype ? `/${parsed.subtype}` : '';
    let detail = '';
    if (type === 'user') {
      const c = parsed.message?.content;
      detail = ` contentLen=${typeof c === 'string' ? c.length : JSON.stringify(c)?.length}`;
      if (typeof c === 'string' && c.includes(MARKER)) detail += ' [MARKER HIT]';
    }
    if (type === 'result') {
      resultEvent = parsed;
      detail = ` session_id=${parsed.session_id} is_error=${parsed.is_error} num_turns=${parsed.num_turns}`;
    }
    console.log(`[event ${idx}] +${Date.now() - t0}ms type=${type}${subtype}${detail}`);
    // two 场景：第一条 result 到达后发送第二条
    if (scenario === 'two' && type === 'result' && sentCount === 1) {
      sendSecond();
    }
  }
});

child.stderr.on('data', (chunk) => {
  stderrBuf += chunk.toString('utf8');
});

let sentCount = 0;

function sendFirst() {
  let content;
  if (scenario === 'long') {
    // 构造 >4KB 多行文本：marker 在开头与结尾各出现一次，中间填充带行号的重复行
    const lines = [`begin ${MARKER}`];
    for (let i = 0; i < 120; i++) {
      lines.push(`line-${String(i).padStart(3, '0')} 多行回显探针 padding padding padding padding`);
    }
    lines.push(`end ${MARKER}`);
    content = lines.join('\n') + '\n\nReply with exactly: OK';
    console.log(`[harness] long message bytes=${Buffer.byteLength(content, 'utf8')}`);
  } else {
    content = `probe ${MARKER} one. Reply with exactly: OK`;
  }
  const line = userMsg(content);
  transcript.write('> ' + line + '\n'); // "> " 前缀 = stdin 方向
  child.stdin.write(line + '\n');
  sentCount = 1;
  console.log(`[harness] sent message #1 (bytes=${Buffer.byteLength(line, 'utf8')})`);
  if (scenario === 'single' || scenario === 'long') {
    child.stdin.end();
    console.log('[harness] stdin closed (single-shot)');
  }
}

function sendSecond() {
  const content = `probe ${MARKER} two. Reply with exactly: OK`;
  const line = userMsg(content);
  transcript.write('> ' + line + '\n');
  child.stdin.write(line + '\n');
  sentCount = 2;
  console.log('[harness] sent message #2, then closing stdin');
  child.stdin.end();
}

if (scenario !== 'badflag') {
  sendFirst();
}

const exitInfo = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    console.error('[harness] TIMEOUT waiting for exit; killing child');
    child.kill('SIGKILL');
    resolve({ code: null, signal: 'TIMEOUT_KILL' });
  }, RESULT_TIMEOUT_MS);
  child.on('exit', (code, signal) => {
    clearTimeout(timer);
    resolve({ code, signal });
  });
});

// 冲刷 stdout buffer 里可能残留的非换行结尾内容
if (stdoutBuf.trim()) {
  transcript.write(stdoutBuf + '\n');
}

const meta = {
  scenario,
  noReplay,
  args,
  cwd: PROBE_CWD,
  claude: CLAUDE,
  startedAt: new Date(t0).toISOString(),
  durationMs: Date.now() - t0,
  exit: exitInfo,
  resultReceived: resultEvent != null,
  resultSummary: resultEvent
    ? {
        subtype: resultEvent.subtype,
        session_id: resultEvent.session_id,
        is_error: resultEvent.is_error,
        num_turns: resultEvent.num_turns,
        total_cost_usd: resultEvent.total_cost_usd,
        usage: resultEvent.usage,
        result: typeof resultEvent.result === 'string' ? resultEvent.result.slice(0, 200) : resultEvent.result,
        errors: resultEvent.errors,
      }
    : null,
  eventCount: events.length,
  eventTypes: events.map((e) => (e.parsed ? `${e.parsed.type}${e.parsed.subtype ? '/' + e.parsed.subtype : ''}` : 'non-json')),
  stderrTail: stderrBuf.slice(-2000),
  transcriptPath,
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2));
transcript.end();

console.log(`[harness] exit code=${exitInfo.code} signal=${exitInfo.signal} resultReceived=${meta.resultReceived}`);
console.log(`[harness] transcript: ${transcriptPath}`);
console.log(`[harness] meta: ${metaPath}`);
