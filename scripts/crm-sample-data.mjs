/**
 * Thin wrapper for the local sample-data commands:
 *   npm run crm:sample-data [-- --no-staff]          (seed-sample)
 *   npm run crm:clear-sample [-- --include-edited]   (clear-sample)
 *   npm run crm:platform-sample [-- --no-staff]      (seed-platform-sample)
 *   npm run crm:clear-platform-sample                (clear-platform-sample)
 * Company sample data goes into a company Admin's workspace only (BO1a). The platform
 * commands fill Blaqks One's own clients, help requests, team chat and sample team.
 * The binary asks for the Admin email (or reads CRM_SAMPLE_ADMIN_EMAIL), shows the
 * database, workspace and Admin, asks to confirm, then prompts for an optional staff
 * password. It refuses outside the local configuration and on an unmarked database.
 */
import { spawn } from 'node:child_process';

const [mode, ...flags] = process.argv.slice(2);
const command = {
  seed: 'seed-sample',
  clear: 'clear-sample',
  'platform-seed': 'seed-platform-sample',
  'platform-clear': 'clear-platform-sample',
}[mode];
if (!command) {
  console.error('Use npm run crm:sample-data, crm:clear-sample or crm:platform-sample.');
  process.exit(1);
}

const env = { ...process.env };
// Staff passwords come only from the prompt or are generated; never from the environment.
delete env.CRM_SAMPLE_STAFF_PASSWORD;
const child = spawn(
  'cargo',
  ['run', '--locked', '--manifest-path', 'services/crm-api/Cargo.toml', '--', command, ...flags],
  { env, stdio: 'inherit' },
);
child.on('error', () => {
  console.error('Could not run the CRM sample-data command. Check the Rust installation.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
