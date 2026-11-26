/**
 * Prints the API test files for one shard: `node scripts/crm-api-shard.mjs <index> <total>`.
 * Shards are round-robin so they stay similar in size, and each keeps its canonical order.
 * Pass the result as API_TEST_FILES to `npm run test:api` (see crm-api-test-files.mjs).
 */
import { apiTestFiles } from './crm-api-test-files.mjs';

const [indexArg, totalArg] = process.argv.slice(2);
const index = Number(indexArg);
const total = Number(totalArg);
if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1) {
  console.error('Usage: node scripts/crm-api-shard.mjs <index> <total>');
  process.exit(1);
}
if (index < 1 || index > total) {
  console.error(`Shard ${index} is outside 1..${total}.`);
  process.exit(1);
}
const shard = apiTestFiles.filter((_, position) => position % total === index - 1);
if (!shard.length) {
  console.error('No API test files were assigned to this shard.');
  process.exit(1);
}
process.stdout.write(shard.join(','));
