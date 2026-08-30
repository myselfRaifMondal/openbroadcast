/**
 * Probe every stream in data/channels.approved.json and report which channels
 * actually respond.
 *
 * The filter only guarantees a stream URL exists and needs no spoofed headers.
 * It says nothing about whether the endpoint is still up. This fetches each
 * HLS manifest and classifies the result.
 *
 * A failure here is not always a dead channel: many broadcasters geo-fence, so
 * a 403 from this machine may be a healthy stream in its own country. Those
 * are reported separately from genuinely unreachable endpoints.
 *
 * Usage:
 *   npm run check:streams              # probe and report
 *   npm run check:streams -- --prune   # also drop unreachable channels
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ApprovedDataset } from './filter-channels';

const FILE = path.join(process.cwd(), 'data', 'channels.approved.json');
const REPORT = path.join(process.cwd(), 'data', 'stream-health.json');
const CONCURRENCY = 64;
const TIMEOUT_MS = 10_000;
/**
 * A slow stream under 64-way concurrency looks identical to a dead one, so
 * everything that fails the first pass is retried alone, with more patience,
 * before it is called dead.
 */
const RETRY_CONCURRENCY = 40;
const RETRY_TIMEOUT_MS = 20_000;
const PRUNE = process.argv.includes('--prune');

type Verdict = 'live' | 'geo-blocked' | 'dead';

interface Probe {
  url: string;
  verdict: Verdict;
  detail: string;
}

async function probe(url: string, timeoutMs = TIMEOUT_MS): Promise<Probe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: '*/*' },
    });

    if (res.status === 403 || res.status === 451) {
      return { url, verdict: 'geo-blocked', detail: `HTTP ${res.status}` };
    }
    if (!res.ok) {
      return { url, verdict: 'dead', detail: `HTTP ${res.status}` };
    }

    const body = (await res.text()).slice(0, 2048);
    if (body.includes('#EXTM3U')) {
      return { url, verdict: 'live', detail: 'manifest ok' };
    }
    return { url, verdict: 'dead', detail: 'not an HLS manifest' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const detail = /abort/i.test(msg) ? `timeout after ${timeoutMs}ms` : msg;
    return { url, verdict: 'dead', detail };
  } finally {
    clearTimeout(timer);
  }
}

/** Run `tasks` with a fixed number of workers. */
async function pool<T>(tasks: (() => Promise<T>)[], size: number) {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const i = cursor++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

async function main() {
  const dataset = JSON.parse(await readFile(FILE, 'utf8')) as ApprovedDataset;
  const channels = dataset.channels;

  // One probe per stream, deduplicated across channels sharing a URL.
  const urls = [...new Set(channels.flatMap((c) => c.streams.map((s) => s.url)))];
  console.log(
    `Probing ${urls.length} unique stream URLs across ${channels.length} channels ` +
      `(${CONCURRENCY} at a time, ${TIMEOUT_MS / 1000}s timeout)…`,
  );

  let done = 0;
  const probes = await pool(
    urls.map((url) => async () => {
      const result = await probe(url);
      done += 1;
      if (done % 500 === 0) {
        process.stdout.write(`  ${done}/${urls.length}\n`);
      }
      return result;
    }),
    CONCURRENCY,
  );

  const byUrl = new Map(probes.map((p) => [p.url, p]));

  // Second pass: retry the failures slowly. A stream that answers now was
  // starved by the first pass, not dead.
  const retryUrls = probes.filter((p) => p.verdict === 'dead').map((p) => p.url);
  if (retryUrls.length > 0) {
    console.log(
      `\nRetrying ${retryUrls.length} failures at ${RETRY_TIMEOUT_MS / 1000}s timeout, ` +
        `${RETRY_CONCURRENCY} at a time…`,
    );
    let recovered = 0;
    const retries = await pool(
      retryUrls.map((url) => () => probe(url, RETRY_TIMEOUT_MS)),
      RETRY_CONCURRENCY,
    );
    for (const r of retries) {
      if (r.verdict !== 'dead') recovered += 1;
      byUrl.set(r.url, r);
    }
    console.log(`  recovered ${recovered} of ${retryUrls.length} on retry`);
  }

  const perChannel = channels.map((c) => {
    const results = c.streams.map((s) => byUrl.get(s.url)!);
    const verdict: Verdict = results.some((r) => r.verdict === 'live')
      ? 'live'
      : results.some((r) => r.verdict === 'geo-blocked')
        ? 'geo-blocked'
        : 'dead';
    return { id: c.id, name: c.name, country: c.country, verdict, results };
  });

  const counts = { live: 0, 'geo-blocked': 0, dead: 0 } as Record<Verdict, number>;
  perChannel.forEach((c) => (counts[c.verdict] += 1));

  const pct = (n: number) => `${((n / perChannel.length) * 100).toFixed(1)}%`;
  console.log('\nChannel health:');
  console.log(`  live         ${String(counts.live).padStart(5)}  ${pct(counts.live)}`);
  console.log(
    `  geo-blocked  ${String(counts['geo-blocked']).padStart(5)}  ${pct(counts['geo-blocked'])}  (403/451 — may work in-country)`,
  );
  console.log(`  dead         ${String(counts.dead).padStart(5)}  ${pct(counts.dead)}`);

  const deadReasons: Record<string, number> = {};
  perChannel
    .filter((c) => c.verdict === 'dead')
    .forEach((c) => {
      const d = c.results[0]?.detail ?? 'unknown';
      const key = d.replace(/^(getaddrinfo|connect) .*/i, '$1 failure').slice(0, 48);
      deadReasons[key] = (deadReasons[key] ?? 0) + 1;
    });
  console.log('\nTop failure modes:');
  Object.entries(deadReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([r, n]) => console.log(`  ${String(n).padStart(5)}  ${r}`));

  await writeFile(
    REPORT,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        method: `two-pass: ${TIMEOUT_MS / 1000}s/${CONCURRENCY}-way, failures retried at ${RETRY_TIMEOUT_MS / 1000}s/${RETRY_CONCURRENCY}-way`,
        mode: dataset.mode,
        counts,
        channels: perChannel.map(({ id, verdict }) => ({ id, verdict })),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`\nWrote ${REPORT}`);

  if (PRUNE) {
    const keep = new Set(
      perChannel.filter((c) => c.verdict !== 'dead').map((c) => c.id),
    );
    const pruned = channels.filter((c) => keep.has(c.id));
    dataset.channels = pruned;
    dataset.counts.approved = pruned.length;
    dataset.counts.rejected = dataset.counts.sourceChannels - pruned.length;
    dataset.rejectionReasons['stream unreachable (two-pass probe)'] = counts.dead;
    dataset.streamHealth = {
      checkedAt: new Date().toISOString(),
      live: counts.live,
      geoBlocked: counts['geo-blocked'],
      pruned: counts.dead,
    };
    await writeFile(FILE, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
    console.log(`Pruned ${counts.dead} dead channels — ${pruned.length} remain.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
