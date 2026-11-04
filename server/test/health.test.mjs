// Starts PocketBase with the repository's migrations and hooks on a temporary data folder
// and checks the health endpoints. Run with `npm test` from server/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(
  serverDir,
  'bin',
  process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase',
);

let pocketbase;
let baseUrl;
let dataDir;
let output = '';

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

async function waitUntilReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pocketbase.exitCode !== null) {
      throw new Error(`PocketBase exited with code ${pocketbase.exitCode}:\n${output}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`PocketBase did not start within ${timeoutMs} ms:\n${output}`);
}

before(async () => {
  if (!existsSync(binary)) {
    throw new Error('PocketBase is not installed. Run ./scripts/download.sh first.');
  }
  dataDir = mkdtempSync(path.join(tmpdir(), 'pawly-pb-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  pocketbase = spawn(
    binary,
    [
      'serve',
      `--http=127.0.0.1:${port}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${path.join(serverDir, 'pb_migrations')}`,
      `--hooksDir=${path.join(serverDir, 'pb_hooks')}`,
      '--hooksWatch=false',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  pocketbase.stdout.on('data', (chunk) => (output += chunk));
  pocketbase.stderr.on('data', (chunk) => (output += chunk));
  await waitUntilReady(`${baseUrl}/api/health`, 20_000);
});

after(() => {
  pocketbase?.kill();
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('PocketBase answers its built-in health check', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
});

test('the Pawly health route from pb_hooks responds', async () => {
  const response = await fetch(`${baseUrl}/api/pawly/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});

test('the migrations ran: the app is named Pawly', async () => {
  const body = await (await fetch(`${baseUrl}/api/pawly/health`)).json();
  assert.equal(body.app, 'Pawly');
});

test('unknown routes return 404', async () => {
  const response = await fetch(`${baseUrl}/api/pawly/does-not-exist`);
  assert.equal(response.status, 404);
});
