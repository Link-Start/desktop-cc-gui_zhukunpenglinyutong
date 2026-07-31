// S3 Spike: 最小 ACP stdio JSON-RPC client（newline-delimited JSON-RPC over stdio）
// 用法: const client = await spawnAcp({ cwd, transcriptPath })
//   await client.request('initialize', {...})
//   client.notify('session/cancel', {...})
//   client.onNotification((msg) => ...)
// 所有收发的 raw line 都会逐行写入 transcriptPath（收发方向带前缀）。
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import {
  createWriteStream,
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;

export function resolveSandboxPath(sandboxRoot, candidatePath, { allowMissing = false } = {}) {
  const canonicalRoot = realpathSync(sandboxRoot);
  const absolutePath = resolve(canonicalRoot, candidatePath);
  const lexicalPath = relative(canonicalRoot, absolutePath);
  if (lexicalPath === '..' || lexicalPath.startsWith(`..${sep}`)) {
    throw new Error(`path escapes ACP spike sandbox: ${candidatePath}`);
  }
  const canonicalPath =
    allowMissing && !existsSync(absolutePath)
      ? resolve(realpathSync(dirname(absolutePath)), basename(absolutePath))
      : realpathSync(absolutePath);
  const fromRoot = relative(canonicalRoot, canonicalPath);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`path escapes ACP spike sandbox: ${candidatePath}`);
  }
  return canonicalPath;
}

export function spawnAcp({
  cwd,
  transcriptPath,
  env = {},
  autoApprovePermissions = false,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}) {
  const sandboxRoot = realpathSync(cwd);
  const child = spawn('kimi', ['acp'], {
    cwd: sandboxRoot,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const transcript = createWriteStream(transcriptPath, { flags: 'a' });
  const log = (dir, line) => transcript.write(`${dir} ${line}\n`);

  const pending = new Map(); // id -> {resolve, reject, timer}
  const notificationHandlers = [];
  const stderrLines = [];
  let nextId = 1;

  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    log('<<', line);
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // 非 JSON 行（启动日志等）直接忽略
    }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const entry = pending.get(msg.id);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
        else entry.resolve(msg.result);
      }
      return;
    }
    // agent -> client 的 request（带 id 且带 method）：必须回 response，否则 agent 会卡住。
    if (msg.id !== undefined && msg.method) {
      handleAgentRequest(msg);
      return;
    }
    // notification 走 handler。
    for (const handler of notificationHandlers) handler(msg);
  });

  // 对 agent->client request 的最小实现：
  // - session/request_permission: 默认拒绝；仅显式 autoApprovePermissions 才选 allow
  // - fs/read_text_file / fs/write_text_file: realpath 后限制在 cwd 内
  function handleAgentRequest(msg) {
    let result;
    try {
      if (msg.method === 'session/request_permission') {
        const options = msg.params?.options ?? [];
        const candidates = autoApprovePermissions
          ? options.filter((option) => String(option.kind).startsWith('allow'))
          : options.filter((option) => !String(option.kind).startsWith('allow'));
        const selected = candidates[0];
        if (!selected) throw new Error('no permission option matches spike policy');
        result = { outcome: { outcome: 'selected', optionId: selected.optionId } };
      } else if (msg.method === 'fs/read_text_file') {
        const safePath = resolveSandboxPath(sandboxRoot, msg.params.path);
        result = { content: readFileSync(safePath, 'utf-8') };
      } else if (msg.method === 'fs/write_text_file') {
        const safePath = resolveSandboxPath(sandboxRoot, msg.params.path, { allowMissing: true });
        writeFileSync(safePath, msg.params.content, 'utf-8');
        result = {};
      } else {
        throw new Error(`unsupported agent request: ${msg.method}`);
      }
      const line = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result });
      log('>>', line);
      child.stdin.write(line + '\n');
    } catch (e) {
      const line = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32603, message: String(e) },
      });
      log('>>', line);
      child.stdin.write(line + '\n');
    }
    for (const handler of notificationHandlers) handler(msg); // 也记录给观察者
  }

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrLines.push(text);
    for (const line of text.split('\n')) if (line.trim()) log('!!', line);
  });

  function rejectPending(reason) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(reason);
    }
    pending.clear();
  }

  child.on('error', (error) => rejectPending(error));
  child.on('exit', (code, signal) => {
    rejectPending(new Error(`kimi acp exited before response (code=${code}, signal=${signal})`));
    transcript.end();
  });

  function request(method, params, timeoutMs = requestTimeoutMs) {
    const id = nextId++;
    const msg = { jsonrpc: '2.0', id, method, params };
    const line = JSON.stringify(msg);
    log('>>', line);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method} (id=${id})`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(line + '\n');
    });
  }

  function notify(method, params) {
    const msg = { jsonrpc: '2.0', method, params };
    const line = JSON.stringify(msg);
    log('>>', line);
    child.stdin.write(line + '\n');
  }

  function onNotification(handler) {
    notificationHandlers.push(handler);
  }

  function close() {
    child.stdin.end();
    child.kill('SIGTERM');
  }

  return {
    child,
    request,
    notify,
    onNotification,
    close,
    stderrLines,
    exitPromise: new Promise((resolve) => child.on('exit', resolve)),
  };
}

// 标准 initialize 请求（ACP protocolVersion 1）
export function initializeParams() {
  return {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: false,
    },
    clientInfo: { name: 'mossx-s3-spike', version: '0.1.0' },
  };
}
