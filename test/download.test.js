import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { downloadParquet } from '../scripts/download.js';

const now = new Date('2026-09-05T12:00:00Z');
let directory;
let filePath;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'geocode-download-'));
  filePath = path.join(directory, 'data', 'admin.parquet');
  await mkdir(path.dirname(filePath), { recursive: true });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('skips a recent local file', async () => {
  await writeFile(filePath, 'existing');
  await utimes(filePath, now, now);
  let fetched = false;

  const result = await downloadParquet({
    filePath,
    now: () => now,
    fetchImpl: async () => {
      fetched = true;
      return new Response('unused');
    },
  });

  assert.equal(result, 'fresh');
  assert.equal(fetched, false);
});

test('streams a successful download into place', async () => {
  const result = await downloadParquet({
    filePath,
    now: () => now,
    fetchImpl: async () => new Response('parquet-data', { status: 200 }),
  });

  assert.equal(result, 'downloaded');
  assert.equal(await readFile(filePath, 'utf8'), 'parquet-data');
});

test('touches an old file after a not-modified response', async () => {
  const oldDate = new Date('2026-01-01T00:00:00Z');
  await writeFile(filePath, 'existing');
  await utimes(filePath, oldDate, oldDate);

  const result = await downloadParquet({
    filePath,
    now: () => now,
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers['if-modified-since'], oldDate.toUTCString());
      return new Response(null, { status: 304 });
    },
  });

  assert.equal(result, 'not-modified');
  assert.equal((await stat(filePath)).mtime.getTime(), now.getTime());
});

test('preserves an old file when a download fails', async () => {
  const oldDate = new Date('2026-01-01T00:00:00Z');
  await writeFile(filePath, 'existing');
  await utimes(filePath, oldDate, oldDate);

  await assert.rejects(
    downloadParquet({
      filePath,
      now: () => now,
      fetchImpl: async () => new Response('failure', { status: 503 }),
    }),
    /HTTP status 503/,
  );
  assert.equal(await readFile(filePath, 'utf8'), 'existing');
  await assert.rejects(stat(`${filePath}.tmp`), { code: 'ENOENT' });
});
