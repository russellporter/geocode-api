import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';

const serverEntryPoint = fileURLToPath(
  new URL('../dist/index.js', import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL(
    '../example-data/whosonfirst-data-admin-andorra-integration-test.parquet',
    import.meta.url,
  ),
);

let baseUrl;
let serverProcess;

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  const { port } = address;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForServer(process) {
  let stderr = '';
  process.stderr.setEncoding('utf8');
  process.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Server startup timed out. ${stderr}`));
    }, 15_000);

    process.stdout.setEncoding('utf8');
    process.stdout.on('data', (chunk) => {
      if (chunk.includes('Server running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    process.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Server exited before startup (code ${code}, signal ${signal}). ${stderr}`,
        ),
      );
    });
  });
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, body: await response.json() };
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [serverEntryPoint], {
    env: {
      ...process.env,
      PORT: String(port),
      PARQUET_PATH: fixturePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(serverProcess);
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill('SIGTERM');
    await once(serverProcess, 'exit');
  }
});

test('health check', async () => {
  const { response, body } = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok' });
});

test('reverse geocodes a coordinate and excludes geometry by default', async () => {
  const { response, body } = await request('/reverse?lon=1.5218&lat=42.5063');
  assert.equal(response.status, 200);
  assert(body.geometries.length > 0);
  assert(body.geometries[0].name);
  assert.equal(body.geometries[0].geometry, undefined);
});

test('returns only requested fields', async () => {
  const { response, body } = await request(
    '/reverse?lon=1.5218&lat=42.5063&fields=id,name,placetype',
  );
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body.geometries[0]).sort(), [
    'id',
    'name',
    'placetype',
  ]);
});

test('includes geometry when all fields are requested', async () => {
  const { response, body } = await request(
    '/reverse?lon=1.5218&lat=42.5063&fields=*',
  );
  assert.equal(response.status, 200);
  assert(body.geometries[0].geometry);
});

for (const [name, path] of [
  ['out-of-range longitude', '/reverse?lon=200&lat=37.7749'],
  ['missing latitude', '/reverse?lon=-122.4194'],
  [
    'unknown field',
    '/reverse?lon=-122.4194&lat=37.7749&fields=invalid_field_xyz',
  ],
  ['non-numeric longitude', '/reverse?lon=abc&lat=37.7749'],
]) {
  test(`rejects ${name}`, async () => {
    const { response, body } = await request(path);
    assert.equal(response.status, 400);
    assert(body.error);
  });
}
