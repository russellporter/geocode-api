const { execSync } = require('child_process');
const { existsSync, statSync, utimesSync, mkdirSync, renameSync, unlinkSync } = require('fs');

const DATA_DIR = 'data';
const FILE_PATH = `${DATA_DIR}/whosonfirst-data-admin.parquet`;
const TEMP_FILE_PATH = `${FILE_PATH}.tmp`;
const URL = 'https://data.geocode.earth/wof/dist/parquet/whosonfirst-data-admin-latest.parquet';
const MAX_AGE_DAYS = 30;

mkdirSync(DATA_DIR, { recursive: true });

const shouldCheck = () => {
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
  const curlArgs = ['-L', '-w', '%{http_code}'];

  if (existsSync(FILE_PATH)) {
    curlArgs.push('-z', FILE_PATH);
  }

  // Download to temporary file to avoid corrupting existing valid file
  curlArgs.push('-o', TEMP_FILE_PATH, URL);

  const command = `curl ${curlArgs.join(' ')}`;
  console.log(`Running: ${command}`);

  let httpCode;
  try {
    const output = execSync(command, { encoding: 'utf8' });
    httpCode = output.trim();
  } catch (error) {
    console.error('Download failed:', error.message);
    // Clean up temp file if it exists
    if (existsSync(TEMP_FILE_PATH)) {
      unlinkSync(TEMP_FILE_PATH);
    }
    process.exit(1);
  }

  // Check if the HTTP status code indicates success (2xx) or not modified (304)
  const statusCode = parseInt(httpCode, 10);
  if (statusCode >= 200 && statusCode < 300) {
    console.log(`Download successful (HTTP ${statusCode})`);
    // Move temp file to final location
    if (existsSync(TEMP_FILE_PATH)) {
      renameSync(TEMP_FILE_PATH, FILE_PATH);
      const now = new Date();
      utimesSync(FILE_PATH, now, now);
    }
  } else if (statusCode === 304) {
    console.log('File is up to date (HTTP 304 Not Modified)');
    // Clean up temp file if it exists (shouldn't with 304, but be safe)
    if (existsSync(TEMP_FILE_PATH)) {
      unlinkSync(TEMP_FILE_PATH);
    }
    // Update the existing file's modification time to mark that we checked
    if (existsSync(FILE_PATH)) {
      const now = new Date();
      utimesSync(FILE_PATH, now, now);
    }
  } else {
    console.error(`Download failed with HTTP status ${statusCode}`);
    // Remove the temp file with error response
    if (existsSync(TEMP_FILE_PATH)) {
      unlinkSync(TEMP_FILE_PATH);
      console.log('Removed failed download');
    }
    // Don't touch the existing valid file
    process.exit(1);
  }
}
