// Run precompute per jewel in a fresh process with a larger heap — building all
// rows for a replace-heavy jewel (GV/EH) in one process can exhaust the default heap.
import { execFileSync } from 'node:child_process';

for (let j = 1; j <= 6; j++) {
  console.log(`=== precompute jewel ${j} ===`);
  execFileSync(
    process.execPath,
    ['--max-old-space-size=4096', '--import', 'tsx', 'tools/precompute/precompute.ts', '--jewel', String(j)],
    { stdio: 'inherit' },
  );
}
