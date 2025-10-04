import { execSync } from 'child_process';
import { existsSync, statSync, utimesSync } from 'fs';
import { mkdirSync } from 'fs';

const DATA_DIR = 'data';
const FILE_PATH = `${DATA_DIR}/whosonfirst-data-admin.parquet`;
const URL = 'https://data.geocode.earth/wof/dist/parquet/whosonfirst-data-admin-latest.parquet';
const MAX_AGE_DAYS = 30;

mkdirSync(DATA_DIR, { recursive: true });

const shouldCheck = (): boolean => {
  if (!existsSync(FILE_PATH)) {
    console.log('File does not exist, downloading...');
    return true;
  }

  const stats = statSync(FILE_PATH);
  const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays > MAX_AGE_DAYS) {
    console.log(`File is ${Math.floor(ageInDays)} days old (>${MAX_AGE_DAYS} days), checking for updates...`);
    return true;
  }

  console.log(`File is recent (${Math.floor(ageInDays)} days old), skipping download`);
  return false;
};

if (shouldCheck()) {
  const curlArgs = ['-L'];

  if (existsSync(FILE_PATH)) {
    curlArgs.push('-z', FILE_PATH);
  }

  curlArgs.push('-o', FILE_PATH, URL);

  const command = `curl ${curlArgs.join(' ')}`;
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });

  // Update the file's modification time to mark that we checked
  if (existsSync(FILE_PATH)) {
    const now = new Date();
    utimesSync(FILE_PATH, now, now);
  }
}
