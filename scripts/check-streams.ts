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

async function probe(
  url: string,
  timeoutMs = TIMEOUT_MS,
  extraHeaders: Record<string, string> = {},
): Promise<Probe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: '*/*', ...extraHeaders },
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

/**
 * hls.js fetches segments with XHR, so the segment origin must return CORS
 * headers or the browser blocks it — however healthy the stream is
 * server-side. Only matters for proxy-only channels: everything else reaches
 * the browser the same way it reached this probe.
 *
 * Returns true when a browser would actually be able to play the stream.
 */
async function segmentsAllowBrowser(
  manifestUrl: string,
  extraHeaders: Record<string, string>,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RETRY_TIMEOUT_MS);
  try {
    const res = await fetch(manifestUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: '*/*', ...extraHeaders },
    });
    if (!res.ok) return false;

    const body = await res.text();
    const first = body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    if (!first) return false;

    const child = new URL(first, res.url || manifestUrl).toString();
    const seg = await fetch(child, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { origin: 'https://openbroadcast.vercel.app' },
    });
    if (!seg.ok) return false;

    const allow = seg.headers.get('access-control-allow-origin');
    return allow === '*' || allow === 'https://openbroadcast.vercel.app';
  } catch {
    return false;
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

  // Header-gated streams must be probed the way the app plays them — through
  // their headers — or every channel behind the manifest proxy is condemned as
  // dead despite working fine.
  const headersByUrl = new Map<string, Record<string, string>>();
  for (const channel of channels) {
    for (const s of channel.streams) {
      if (!s.needsCustomHeaders) continue;
      const h: Record<string, string> = {};
      if (s.userAgent) h['user-agent'] = s.userAgent;
      if (s.referrer) h.referer = s.referrer;
      headersByUrl.set(s.url, h);
    }
  }

  // One probe per stream, deduplicated across channels sharing a URL.
  const urls = [...new Set(channels.flatMap((c) => c.streams.map((s) => s.url)))];
  console.log(
    `Probing ${urls.length} unique stream URLs across ${channels.length} channels ` +
      `(${CONCURRENCY} at a time, ${TIMEOUT_MS / 1000}s timeout)…`,
  );

  let done = 0;
  const probes = await pool(
    urls.map((url) => async () => {
      const result = await probe(url, TIMEOUT_MS, headersByUrl.get(url) ?? {});
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
      retryUrls.map(
        (url) => () => probe(url, RETRY_TIMEOUT_MS, headersByUrl.get(url) ?? {}),
      ),
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

  // Third pass: for channels that only exist behind the manifest proxy, prove a
  // browser could actually play them. A stream that answers this probe but has
  // no CORS on its segments plays nowhere, and listing it would be a lie.
  const proxyOnlyChannels = channels.filter(
    (c) => c.streams.every((s) => s.needsCustomHeaders) && c.streams.length > 0,
  );
  const browserPlayable = new Set<string>();
  if (proxyOnlyChannels.length > 0) {
    console.log(
      `\nChecking segment CORS for ${proxyOnlyChannels.length} proxy-only channels…`,
    );
    await pool(
      proxyOnlyChannels.map((c) => async () => {
        for (const s of c.streams) {
          const h: Record<string, string> = {};
          if (s.userAgent) h['user-agent'] = s.userAgent;
          if (s.referrer) h.referer = s.referrer;
          if (await segmentsAllowBrowser(s.url, h)) {
            browserPlayable.add(c.id);
            return;
          }
        }
      }),
      16,
    );
    console.log(
      `  ${browserPlayable.size} of ${proxyOnlyChannels.length} are playable in a browser`,
    );
  }
  const proxyOnlyIds = new Set(proxyOnlyChannels.map((c) => c.id));
  for (const c of perChannel) {
    if (proxyOnlyIds.has(c.id) && !browserPlayable.has(c.id)) {
      c.verdict = 'dead';
    }
  }

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
    // Geo-blocked channels are kept: a 403 from a directly-played stream means
    // a healthy feed fenced to its own country, and it plays in-country.
    //
    // That inference does not hold for a channel reachable ONLY through the
    // manifest proxy. There a 403 is ambiguous — it could be geo-fencing, or
    // the origin rejecting our headers or our datacenter IP. Since it cannot be
    // told apart, those are dropped rather than listed as working.
    const proxiedOnly = new Map(
      channels.map((c) => [c.id, proxyOnlyIds.has(c.id)]),
    );
    const unverifiableProxy = perChannel.filter(
      (c) => proxiedOnly.get(c.id) && c.verdict !== 'live',
    ).length;

    const keep = new Set(
      perChannel
        .filter((c) => c.verdict !== 'dead')
        .filter((c) => !(proxiedOnly.get(c.id) && c.verdict !== 'live'))
        .map((c) => c.id),
    );
    const pruned = channels.filter((c) => keep.has(c.id));
    dataset.channels = pruned;
    dataset.counts.approved = pruned.length;
    dataset.counts.rejected = dataset.counts.sourceChannels - pruned.length;
    dataset.rejectionReasons['stream unreachable (two-pass probe)'] = counts.dead;
    if (unverifiableProxy > 0) {
      dataset.rejectionReasons['proxy-only stream could not be verified'] =
        unverifiableProxy;
    }
    dataset.streamHealth = {
      checkedAt: new Date().toISOString(),
      live: counts.live,
      geoBlocked: counts['geo-blocked'],
      pruned: counts.dead,
    };
    await writeFile(FILE, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
    console.log(
      `Pruned ${counts.dead} dead channels` +
        (unverifiableProxy > 0
          ? ` and ${unverifiableProxy} unverifiable proxy-only channels`
          : '') +
        ` — ${pruned.length} remain.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
