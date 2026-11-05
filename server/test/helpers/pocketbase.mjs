// Starts a throwaway PocketBase with the repository's migrations and hooks, on a free port
// and a temporary data folder, and offers small helpers to call its API.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const binary = path.join(
  serverDir,
  'bin',
  process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase',
);

export const SUPERUSER = { email: 'superuser@pawly.test', password: 'superuser-password-123' };

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ATTEMPTS = 5;

/**
 * Runs `pocketbase serve` on a free port and waits until it answers. Test files run in
 * parallel, so another server can take the port between choosing it and binding it: then
 * this process exits and it tries another port. It only trusts the port once its own output
 * says it started there (a health check alone could reach another test's server).
 */
async function launch(dirs, env) {
  for (let attempt = 1; ; attempt += 1) {
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const log = { text: '' };
    const proc = spawn(
      binary,
      ['serve', `--http=127.0.0.1:${port}`, '--hooksWatch=false', ...dirs],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      },
    );
    proc.stdout.on('data', (chunk) => (log.text += chunk));
    proc.stderr.on('data', (chunk) => (log.text += chunk));

    const deadline = Date.now() + 20_000;
    for (;;) {
      if (proc.exitCode !== null) {
        if (attempt < ATTEMPTS && log.text.includes('address already in use')) break;
        throw new Error(`PocketBase exited with code ${proc.exitCode}:\n${log.text}`);
      }
      if (log.text.includes(`Server started at ${baseUrl}`)) {
        try {
          if ((await fetch(`${baseUrl}/api/health`)).ok && proc.exitCode === null) {
            return { proc, baseUrl, log };
          }
        } catch {
          // Not answering yet.
        }
      }
      if (Date.now() > deadline) {
        proc.kill();
        throw new Error(`PocketBase did not start within 20 s:\n${log.text}`);
      }
      await sleep(100);
    }
  }
}

/**
 * Starts PocketBase. `env` adds environment variables; by default push notifications go to an
 * address where nothing listens, so tests never call Expo.
 */
export async function startPocketBase({ env = {} } = {}) {
  if (!existsSync(binary)) {
    throw new Error('PocketBase is not installed. Run ./scripts/download.sh first.');
  }
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pawly-pb-'));
  const dirs = [
    `--dir=${dataDir}`,
    `--migrationsDir=${path.join(serverDir, 'pb_migrations')}`,
    `--hooksDir=${path.join(serverDir, 'pb_hooks')}`,
  ];
  execFileSync(binary, ['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, ...dirs], {
    stdio: 'ignore',
  });

  const { proc, baseUrl, log } = await launch(dirs, {
    ...process.env,
    PAWLY_PUSH_URL: 'http://127.0.0.1:9/push',
    ...env,
  });

  async function api(urlPath, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = token;
    const response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, body: json };
  }

  /** Waits for the email the dev mail hook prints and returns its link. */
  async function waitForMailLink(to, linkPart, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const line of log.text.split('\n')) {
        if (
          line.includes('[pawly-mail]') &&
          line.includes(`to=${to} `) &&
          line.includes(linkPart)
        ) {
          return /link=(\S+)/.exec(line)[1];
        }
      }
      await sleep(50);
    }
    throw new Error(`No email to ${to} containing "${linkPart}". Output:\n${log.text}`);
  }

  async function stop() {
    proc.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }

  return { baseUrl, api, waitForMailLink, stop, logs: () => log.text };
}
