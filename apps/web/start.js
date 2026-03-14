import { spawn } from 'child_process';

const args = process.argv.slice(2).filter(arg => arg !== '--host');

const next = spawn('next', ['start', '-p', '3000', '-H', '0.0.0.0', ...args], {
  stdio: 'inherit',
  shell: true
});

next.on('close', (code) => {
  process.exit(code);
});
