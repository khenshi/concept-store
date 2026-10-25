import { spawn } from 'node:child_process';

const nextCommand = process.platform === 'win32' ? 'next.cmd' : 'next';
const port = process.env.PORT ?? '3001';
const child = spawn(nextCommand, ['start', '-p', port], {
  env: process.env,
  stdio: 'inherit',
});

const forwardSignal = (signal) => child.kill(signal);
process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

child.once('error', () => process.exit(1));
child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
