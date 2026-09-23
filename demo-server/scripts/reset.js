// Clean-up — list and delete the demo heads created by these scripts.
// Deletion endpoint: DELETE /head/{uuid}.
//
// WARNING: `--apply --all` permanently deletes EVERY head in the org, including
// heads that were not created by this kit. Use it only on a dedicated test org.
//
// Usage:
//   npm run reset                    → list tracked + org heads (nothing deleted)
//   npm run reset -- --apply         → delete the heads tracked in .demo-heads.json
//   npm run reset -- --apply --all   → delete EVERY head in the org (fresh start)
//   npm run reset -- --clear         → just clear the local tracking file
import { api, trackedHeads, clearTrackedHeads } from '../lib/unith.js';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

if (process.argv.includes('--clear')) {
  clearTrackedHeads();
  console.log('Tracking file cleared.');
  process.exit(0);
}

const tracked = trackedHeads();
console.log(`Demo heads tracked locally (${tracked.length}):`);
for (const h of tracked) console.log(`  - ${h.name} (${h.mode})  ${h.id}`);

const all = await api('GET', '/head/all?order=ASC&page=1&take=50');
const orgHeads = all.data ?? [];
console.log(`\nAll heads in the org (${orgHeads.length}):`);
for (const h of orgHeads) {
  console.log(`  - ${h.name} (${h.operationMode})  uuid=${h.id}  publicId=${h.publicId}`);
}

if (!APPLY) {
  console.log('\nNothing deleted. To delete:');
  console.log('  npm run reset -- --apply         (tracked heads only)');
  console.log('  npm run reset -- --apply --all   (EVERY head in the org — irreversible)');
  process.exit(0);
}

// Resolve targets: tracked heads (matching by uuid or publicId), or the whole org.
const targets = ALL
  ? orgHeads
  : orgHeads.filter((h) =>
      tracked.some((t) => t.uuid === h.id || t.id === h.publicId || t.id === h.id));

if (targets.length === 0) {
  console.log('\nNo matching heads to delete.');
  process.exit(0);
}

console.log(`\nDeleting ${targets.length} head(s)…`);
for (const h of targets) {
  try {
    await api('DELETE', `/head/${h.id}`);
    console.log(`  ✓ deleted ${h.name} (${h.publicId})`);
  } catch (err) {
    console.error(`  ✗ ${h.name}: ${err.message.split('\n')[0]}`);
  }
}
clearTrackedHeads();
console.log('\nDone — tracking file cleared.');
