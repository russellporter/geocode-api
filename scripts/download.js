import { createWriteStream } from 'node:fs';
import {
  mkdir,
  rename,
  rm,
  stat,
  utimes,
} from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DEFAULT_FILE_PATH = 'data/whosonfirst-data-admin.parquet';
const DEFAULT_URL =
  'https://data.geocode.earth/wof/dist/parquet/whosonfirst-data-admin-latest.parquet';
const DEFAULT_MAX_AGE_DAYS = 30;

async function getFileStats(filePath) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export async function downloadParquet({
  filePath = DEFAULT_FILE_PATH,
  url = DEFAULT_URL,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });

  const fileStats = await getFileStats(filePath);
  const currentTime = now();
  if (fileStats) {
    const ageInDays =
      (currentTime.getTime() - fileStats.mtime.getTime()) /
      (1000 * 60 * 60 * 24);
    if (ageInDays <= maxAgeDays) {
      console.log(
        `File is recent (${Math.floor(ageInDays)} days old), skipping download`,
      );
      return 'fresh';
    }
    console.log(
      `File is ${Math.floor(ageInDays)} days old (>${maxAgeDays} days), checking for updates...`,
    );
  } else {
    console.log('File does not exist, downloading...');
  }

  const temporaryPath = `${filePath}.tmp`;
  const headers = fileStats
    ? { 'if-modified-since': fileStats.mtime.toUTCString() }
    : undefined;

  try {
    const response = await fetchImpl(url, { headers });

    if (response.status === 304 && fileStats) {
      await utimes(filePath, currentTime, currentTime);
      console.log('File is up to date (HTTP 304 Not Modified)');
      return 'not-modified';
    }

    if (!response.ok) {
      throw new Error(`Download failed with HTTP status ${response.status}`);
    }
    if (!response.body) {
      throw new Error('Download response did not contain a body');
    }

    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporaryPath),
    );
    await rename(temporaryPath, filePath);
    await utimes(filePath, currentTime, currentTime);
    console.log(`Download successful (HTTP ${response.status})`);
    return 'downloaded';
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

if (import.meta.main) {
  downloadParquet().catch((error) => {
    console.error('Download failed:', error);
    process.exitCode = 1;
  });
}
