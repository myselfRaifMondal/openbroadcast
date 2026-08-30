/**
 * Writes public/search-index.json — a compact index the search palette fetches
 * once, on first open.
 *
 * It is a separate file rather than page props because the catalogue is ~7.6k
 * channels: shipping it with every page would put roughly a megabyte into the
 * payload of a page whose job is to play one video.
 *
 * Runs automatically before `next build` via the prebuild script.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ApprovedDataset } from './filter-channels';

const IN = path.join(process.cwd(), 'data', 'channels.approved.json');
const OUT = path.join(process.cwd(), 'public', 'search-index.json');

async function main() {
  const dataset = JSON.parse(await readFile(IN, 'utf8')) as ApprovedDataset;

  // Tuples, not objects: at this size the repeated keys are most of the bytes.
  const rows = dataset.channels.map((c) => [
    c.id,
    c.name,
    c.countryFlag,
    c.countryName,
    c.primaryCategory,
  ]);

  await writeFile(OUT, JSON.stringify(rows), 'utf8');
  const bytes = JSON.stringify(rows).length;
  console.log(
    `search index: ${rows.length} channels, ${(bytes / 1024).toFixed(0)} KB -> ${OUT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
