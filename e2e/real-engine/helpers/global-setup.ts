import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

export default async function setup() {
  const child = fork(path.resolve('scripts/run-dev-bridge.cjs'), [], {
    env: { ...process.env, VITE_STORAGE_NS: 'test' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
  try {
    process.env.ENDSTATE_BRIDGE_SESSION = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Private bridge startup timed out')), 120_000);
      child.once('message', (message: any) => {
        clearTimeout(timeout);
        if (message?.type !== 'ready') reject(new Error('Invalid bridge startup message'));
        else resolve(message.descriptorPath);
      });
      child.once('error', reject);
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Private bridge startup failed')); });
    });
  } catch (error) {
    child.kill();
    throw error;
  }
  return async () => {
    child.kill();
    await once(child, 'exit');
  };
}
