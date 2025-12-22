import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const AUTOSUITE_SCRIPT_PATH = 'C:\\Users\\win-laptop\\Desktop\\projects\\autosuite\\autosuite.ps1';

function checkAutosuiteAvailable() {
  if (!existsSync(AUTOSUITE_SCRIPT_PATH)) {
    console.log('⚠️  Autosuite not found at:', AUTOSUITE_SCRIPT_PATH);
    console.log('   Skipping contract tests.');
    return false;
  }
  return true;
}

function runAutosuite(command, args = []) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      AUTOSUITE_SCRIPT_PATH,
      command,
      '--json',
      ...args,
    ];

    const proc = spawn('pwsh', fullArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function parseEnvelope(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    throw new Error('STDOUT is not valid JSON');
  }
  return JSON.parse(trimmed);
}

async function testCapabilities() {
  console.log('\n📋 Testing: autosuite capabilities --json');
  
  const result = await runAutosuite('capabilities');
  
  if (result.exitCode !== 0) {
    throw new Error(`capabilities exited with code ${result.exitCode}`);
  }

  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (!envelope.cliVersion) {
    throw new Error('Missing cliVersion in envelope');
  }
  if (envelope.command !== 'capabilities') {
    throw new Error(`Expected command 'capabilities', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ CLI version: ${envelope.cliVersion}`);
  console.log(`   ✓ Schema version: ${envelope.schemaVersion}`);
  console.log(`   ✓ Success: ${envelope.success}`);
}

async function testReport() {
  console.log('\n📋 Testing: autosuite report --json');
  
  const result = await runAutosuite('report');
  
  if (result.exitCode !== 0) {
    throw new Error(`report exited with code ${result.exitCode}`);
  }

  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'report') {
    throw new Error(`Expected command 'report', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  console.log(`   ✓ Has state: ${envelope.data?.hasState ?? false}`);
}

async function testVerifyMissing() {
  console.log('\n📋 Testing: autosuite verify --profile Missing --json');
  
  const result = await runAutosuite('verify', ['--profile', 'Missing']);
  
  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'verify') {
    throw new Error(`Expected command 'verify', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  
  if (!envelope.success && envelope.error) {
    console.log(`   ✓ Error code: ${envelope.error.code}`);
    console.log(`   ✓ Error message: ${envelope.error.message}`);
  }
}

async function testApplyMissing() {
  console.log('\n📋 Testing: autosuite apply --profile Missing --dry-run --json');
  
  const result = await runAutosuite('apply', ['--profile', 'Missing', '--dry-run']);
  
  const envelope = parseEnvelope(result.stdout);
  
  if (!envelope.schemaVersion) {
    throw new Error('Missing schemaVersion in envelope');
  }
  if (envelope.command !== 'apply') {
    throw new Error(`Expected command 'apply', got '${envelope.command}'`);
  }
  if (typeof envelope.success !== 'boolean') {
    throw new Error('Missing or invalid success field');
  }
  
  console.log('   ✓ Envelope structure valid');
  console.log(`   ✓ Success: ${envelope.success}`);
  
  if (!envelope.success && envelope.error) {
    console.log(`   ✓ Error code: ${envelope.error.code}`);
    console.log(`   ✓ Error message: ${envelope.error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Contract Integration Tests');
  console.log('================================');
  
  if (!checkAutosuiteAvailable()) {
    process.exit(0);
  }

  try {
    await testCapabilities();
    await testReport();
    await testVerifyMissing();
    await testApplyMissing();
    
    console.log('\n✅ All contract tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Contract test failed:', err.message);
    process.exit(1);
  }
}

runTests();
