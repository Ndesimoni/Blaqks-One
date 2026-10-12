import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { readSecret } from './terminal-secret.mjs';

if (!process.stdin.isTTY) {
  console.error('Run this account setup command in an interactive terminal.');
  process.exit(1);
}

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const answers = {};
try {
  answers.CRM_BOOTSTRAP_NAME = await terminal.question('Full name: ');
  answers.CRM_BOOTSTRAP_EMAIL = await terminal.question('Email address: ');
  answers.CRM_BOOTSTRAP_PHONE = await terminal.question('Phone including country code: ');
  answers.CRM_BOOTSTRAP_ROLE = await terminal.question('Role (super-admin or admin): ');
} finally {
  terminal.close();
}

let password;
let confirmation;
try {
  password = await readSecret('Password (at least 8 characters): ');
  confirmation = await readSecret('Confirm password: ');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (password !== confirmation || [...password].length < 8) {
  console.error('Passwords must match and contain at least 8 characters. No account was created.');
  process.exit(1);
}

const accountEnv = { ...process.env, ...answers };
delete accountEnv.CRM_BOOTSTRAP_PASSWORD;
const child = spawn(
  'cargo',
  ['run', '--locked', '--manifest-path', 'services/crm-api/Cargo.toml', '--', 'create-user'],
  { env: accountEnv, stdio: ['pipe', 'inherit', 'inherit'] },
);
child.stdin.on('error', () => {
  console.error('Account setup stopped before reading the password.');
  process.exitCode = 1;
});
child.stdin.end(`${password}\n`);
child.on('error', () => {
  console.error('Could not run the CRM account setup. Check the Rust installation.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
