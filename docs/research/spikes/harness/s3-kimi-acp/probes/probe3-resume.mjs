// Probe 3: tool_call 捕获 + session/load resume 回放
// 阶段 A: 新 session，发一个必然触发工具调用的 prompt（列出沙箱目录文件），
//         捕获 tool_call / tool_call_update 等 notification 全量内容。
// 阶段 B: 断开连接，新 ACP 进程 + initialize + session/load 恢复同一 sessionId，
//         验证历史是否通过 session/update 回放，记录回放 fidelity（user/assistant/tool）。
import { writeFileSync } from 'node:fs';
import { spawnAcp, initializeParams } from '../lib/acp-client.mjs';

const CWD = process.env.SPIKE_CWD || '/tmp/mossx-s3-spike';
const dir = new URL('../evidence/', import.meta.url).pathname;

// 给工具调用一个确定性的目标文件
writeFileSync(`${CWD}/spike-marker.txt`, 'mossx s3 spike marker\n');

const collect = () => {
  const updates = [];
  return {
    updates,
    handler: (msg) => {
      if (msg.method === 'session/update') updates.push(msg.params.update);
    },
  };
};

// ---------- 阶段 A ----------
const a = collect();
const clientA = spawnAcp({ cwd: CWD, transcriptPath: `${dir}probe3a-turn.transcript.ndjson` });
clientA.onNotification(a.handler);

await clientA.request('initialize', initializeParams());
const session = await clientA.request('session/new', { cwd: CWD, mcpServers: [] });
const sessionId = session.sessionId;
console.log('phase A sessionId:', sessionId);

// 设成 yolo，避免 permission 交互干扰 notification 序列观测
try {
  await clientA.request('session/set_mode', { sessionId, modeId: 'yolo' });
  console.log('set_mode yolo: ok');
} catch (e) {
  console.log('set_mode yolo ERROR:', e.message);
}

const promptResult = await clientA.request('session/prompt', {
  sessionId,
  prompt: [
    {
      type: 'text',
      text: 'Use a tool to list the files in the current directory, then reply with exactly the file names, nothing else.',
    },
  ],
});
console.log('phase A stopReason:', JSON.stringify(promptResult));
const aTypes = a.updates.map((u) => u.sessionUpdate);
console.log('phase A update type sequence:', JSON.stringify(aTypes));
writeFileSync(`${dir}probe3a-updates.json`, JSON.stringify(a.updates, null, 2));
clientA.close();
await new Promise((r) => setTimeout(r, 1500)); // 等进程退出、session 落盘

// ---------- 阶段 B ----------
const b = collect();
const clientB = spawnAcp({ cwd: CWD, transcriptPath: `${dir}probe3b-resume.transcript.ndjson` });
clientB.onNotification(b.handler);

await clientB.request('initialize', initializeParams());
let loadResult;
try {
  loadResult = await clientB.request('session/load', { sessionId, cwd: CWD, mcpServers: [] });
  console.log('phase B session/load result:', JSON.stringify(loadResult));
} catch (e) {
  console.log('phase B session/load ERROR:', e.message);
}
await new Promise((r) => setTimeout(r, 2000)); // 回放可能是异步的，等一拍
const bTypes = b.updates.map((u) => u.sessionUpdate);
console.log('phase B replay update type sequence:', JSON.stringify(bTypes));
console.log('phase B replay update count:', b.updates.length);
writeFileSync(`${dir}probe3b-replay-updates.json`, JSON.stringify(b.updates, null, 2));
clientB.close();
setTimeout(() => process.exit(0), 500);
