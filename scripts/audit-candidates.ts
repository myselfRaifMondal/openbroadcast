/**
 * Maintenance tool: list owners of channels that pass every hard exclusion and
 * have a browser-playable stream, but match no inclusion rule.
 *
 * These are the candidates for review before being added to the allowlist in
 * ./policy.ts. Nothing here is admitted automatically — an owner only earns a
 * place on the allowlist after a human confirms it is a public-service,
 * state, or civic broadcaster.
 *
 * Usage: npm run audit:candidates [minChannels]
 */

import {
  DENIED_CATEGORIES,
  GOVERNMENT_OWNER_PATTERNS,
  PUBLIC_BROADCASTER_OWNERS,
  matchesDeniedBrand,
} from './policy';

const API = 'https://iptv-org.github.io/api';
const MIN = Number(process.argv[2] ?? 1);

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${API}/${name}.json`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return (await res.json()) as T;
}

interface Channel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}
interface Stream {
  channel: string | null;
  url: string;
  user_agent: string | null;
  referrer: string | null;
}

async function main() {
  const [channels, streams, blocklist] = await Promise.all([
    getJson<Channel[]>('channels'),
    getJson<Stream[]>('streams'),
    getJson<{ channel: string }[]>('blocklist'),
  ]);

  const blocked = new Set(blocklist.map((b) => b.channel));
  const playable = new Set(
    streams
      .filter((s) => s.channel && s.url && !s.user_agent && !s.referrer)
      .map((s) => s.channel as string),
  );

  const byOwner = new Map<string, Channel[]>();
  let noOwner = 0;

  for (const ch of channels) {
    if (blocked.has(ch.id) || ch.is_nsfw || ch.closed || ch.replaced_by) continue;
    if (!playable.has(ch.id)) continue;
    if (ch.categories.some((c) => DENIED_CATEGORIES.includes(c))) continue;
    if (matchesDeniedBrand(ch.name, ch.network, ...ch.alt_names, ...ch.owners)) continue;
    if (ch.categories.includes('public') || ch.categories.includes('legislative')) continue;
    if (ch.owners.some((o) => PUBLIC_BROADCASTER_OWNERS.includes(o))) continue;
    if (ch.owners.some((o) => GOVERNMENT_OWNER_PATTERNS.some((p) => p.test(o)))) continue;

    if (ch.owners.length === 0) {
      noOwner += 1;
      continue;
    }
    for (const owner of ch.owners) {
      const list = byOwner.get(owner) ?? [];
      list.push(ch);
      byOwner.set(owner, list);
    }
  }

  const rows = [...byOwner.entries()]
    .filter(([, list]) => list.length >= MIN)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(
    `${rows.length} candidate owners (>= ${MIN} channels); ${noOwner} playable channels have no owner listed at all and stay excluded.\n`,
  );
  for (const [owner, list] of rows) {
    const countries = [...new Set(list.map((c) => c.country))].join(',');
    console.log(
      `${String(list.length).padStart(4)}  ${owner}  [${countries}]  e.g. ${list
        .slice(0, 3)
        .map((c) => c.name)
        .join(' / ')}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
