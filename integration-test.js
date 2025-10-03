const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess;
let testsPassed = 0;
let testsFailed = 0;

function log(message) {
  console.log(`[TEST] ${message}`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    log('Starting server...');
    const exampleDataPath = process.env.PARQUET_PATH || 'example-data/whosonfirst-data-admin-andorra-integration-test.parquet';
    serverProcess = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        PORT,
        PARQUET_PATH: exampleDataPath
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running')) {
        log('Server started successfully');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    serverProcess.on('error', reject);

    // Timeout after 10 seconds
    setTimeout(() => reject(new Error('Server startup timeout')), 10000);
  });
}

function stopServer() {
  if (serverProcess) {
    log('Stopping server...');
    serverProcess.kill();
  }
}

async function makeRequest(path) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url);
  const data = await response.json();
  return { status: response.status, data };
}

async function test(description, testFn) {
  try {
    await testFn();
    log(`✓ ${description}`);
    testsPassed++;
  } catch (error) {
    log(`✗ ${description}`);
    log(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  log('Running integration tests...\n');

  // Test 1: Health check
  await test('Health check endpoint', async () => {
    const { status, data } = await makeRequest('/health');
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.status === 'ok', 'Health check should return status: ok');
  });

  // Test 2: Basic reverse geocode
  await test('Basic reverse geocode (Andorra la Vella)', async () => {
    const { status, data } = await makeRequest('/reverse?lon=1.5218&lat=42.5063');
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(Array.isArray(data.geometries), 'Response should have geometries array');
    assert(data.geometries.length > 0, 'Should return at least one geometry');
    assert(data.geometries[0].name, 'Geometry should have a name');
    assert(!data.geometries[0].geometry, 'Geometry field should be excluded by default');
  });

  // Test 3: Specific fields
  await test('Reverse geocode with specific fields', async () => {
    const { status, data } = await makeRequest('/reverse?lon=1.5218&lat=42.5063&fields=id,name,placetype');
    assert(status === 200, `Expected status 200, got ${status}`);
    const firstResult = data.geometries[0];
    assert(firstResult.id, 'Should have id field');
    assert(firstResult.name, 'Should have name field');
    assert(firstResult.placetype, 'Should have placetype field');
    const keys = Object.keys(firstResult);
    assert(keys.length === 3, `Should have exactly 3 fields, got ${keys.length}`);
  });

  // Test 4: All fields including geometry
  await test('Reverse geocode with all fields (*)', async () => {
    const { status, data } = await makeRequest('/reverse?lon=1.5218&lat=42.5063&fields=*');
    assert(status === 200, `Expected status 200, got ${status}`);
    assert(data.geometries[0].geometry, 'Should include geometry field when using *');
  });

  // Test 5: Invalid coordinates
  await test('Invalid longitude (out of range)', async () => {
    const { status, data } = await makeRequest('/reverse?lon=200&lat=37.7749');
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.error, 'Should return error message');
  });

  // Test 6: Missing parameters
  await test('Missing required parameter (lat)', async () => {
    const { status, data } = await makeRequest('/reverse?lon=-122.4194');
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.error, 'Should return error message');
  });

  // Test 7: Invalid field name
  await test('Invalid field name', async () => {
    const { status, data } = await makeRequest('/reverse?lon=-122.4194&lat=37.7749&fields=invalid_field_xyz');
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.error, 'Should return error message');
  });

  // Test 8: Invalid coordinate format
  await test('Invalid coordinate format (non-numeric)', async () => {
    const { status, data } = await makeRequest('/reverse?lon=abc&lat=37.7749');
    assert(status === 400, `Expected status 400, got ${status}`);
    assert(data.error, 'Should return error message');
  });
}

async function main() {
  try {
    await startServer();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to be fully ready
    await runTests();

    log(`\n${'='.repeat(50)}`);
    log(`Tests passed: ${testsPassed}`);
    log(`Tests failed: ${testsFailed}`);
    log('='.repeat(50));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    stopServer();
  }
}

main();
