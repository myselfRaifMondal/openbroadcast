/**
 * Build-time filter for OpenBroadcast.
 *
 * Fetches the iptv-org public JSON indexes, applies the explicit allowlist
 * policy in ./policy.ts, and writes data/channels.approved.json. The app reads
 * only that file at build time — it never fetches iptv-org at request time.
 *
 * Usage: npm run filter:channels
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BASIS_EXPLANATIONS,
  BASIS_LABELS,
  DENIED_CATEGORIES,
  GOVERNMENT_OWNER_PATTERNS,
  PUBLIC_BROADCASTER_OWNERS,
  matchesDeniedBrand,
  type LicensingBasis,
  type PolicyMode,
} from './policy';

/**
 * POLICY_MODE=open builds a personal catalogue: every channel with a playable
 * stream, no licensing or category filtering. INCLUDE_NSFW=1 additionally
 * keeps adult channels, which open mode still drops by default.
 */
const MODE: PolicyMode = process.env.POLICY_MODE === 'open' ? 'open' : 'public';
const INCLUDE_NSFW = process.env.INCLUDE_NSFW === '1';

const API = 'https://iptv-org.github.io/api';
const OUT_DIR = path.join(process.cwd(), 'data');
const OUT_FILE = path.join(OUT_DIR, 'channels.approved.json');

interface SourceChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

interface SourceStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  user_agent: string | null;
  referrer: string | null;
}

interface SourceFeed {
  channel: string;
  id: string;
  name: string;
  is_main: boolean;
  video_format: string | null;
  languages?: string[];
}

interface SourceCountry {
  code: string;
  name: string;
  flag: string;
  languages: string[];
}

interface SourceLogo {
  channel: string;
  url: string;
  width: number;
  height: number;
  format: string;
}

interface BlocklistEntry {
  channel: string;
  reason: string;
  ref: string;
}

export interface ApprovedStream {
  url: string;
  quality: string | null;
  /** Streams needing a custom UA/referrer cannot be played from a browser. */
  needsCustomHeaders: boolean;
}

export interface ApprovedChannel {
  id: string;
  name: string;
  country: string;
  countryName: string;
  countryFlag: string;
  categories: string[];
  /** Primary category used for grouping in the UI. */
  primaryCategory: string;
  owners: string[];
  network: string | null;
  website: string | null;
  logo: string | null;
  streams: ApprovedStream[];
  licensing: {
    basis: LicensingBasis;
    label: string;
    explanation: string;
    /** The concrete value in the source data that triggered the rule. */
    evidence: string;
    source: string;
  };
}

export interface ApprovedDataset {
  generatedAt: string;
  mode: PolicyMode;
  policyVersion: string;
  source: string;
  counts: {
    sourceChannels: number;
    approved: number;
    rejected: number;
  };
  rejectionReasons: Record<string, number>;
  channels: ApprovedChannel[];
}

const POLICY_VERSION = '1.1.0';

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${API}/${name}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${name}.json: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Positive side of the policy: returns a licensing basis only when an explicit
 * allow rule fires. `null` means "not verifiable" and therefore excluded.
 */
function findLicensingBasis(
  channel: SourceChannel,
): { basis: LicensingBasis; evidence: string } | null {
  if (channel.categories.includes('public')) {
    return {
      basis: 'public-service-category',
      evidence: 'iptv-org category: public',
    };
  }
  if (channel.categories.includes('legislative')) {
    return {
      basis: 'legislative-category',
      evidence: 'iptv-org category: legislative',
    };
  }
  for (const owner of channel.owners) {
    if (PUBLIC_BROADCASTER_OWNERS.includes(owner)) {
      return { basis: 'public-broadcaster-owner', evidence: `Owner: ${owner}` };
    }
  }
  for (const owner of channel.owners) {
    if (GOVERNMENT_OWNER_PATTERNS.some((p) => p.test(owner))) {
      return { basis: 'government-owner', evidence: `Owner: ${owner}` };
    }
  }
  return null;
}

async function main() {
  console.log(
    `Mode: ${MODE}${MODE === 'open' ? ' — no licensing filtering, personal use only' : ''}`,
  );
  console.log('Fetching iptv-org indexes…');
  const [channels, streams, feeds, countries, logos, blocklist] =
    await Promise.all([
      getJson<SourceChannel[]>('channels'),
      getJson<SourceStream[]>('streams'),
      getJson<SourceFeed[]>('feeds'),
      getJson<SourceCountry[]>('countries'),
      getJson<SourceLogo[]>('logos'),
      getJson<BlocklistEntry[]>('blocklist'),
    ]);

  console.log(
    `Source: ${channels.length} channels, ${streams.length} streams, ${logos.length} logos`,
  );

  const blocked = new Set(blocklist.map((b) => b.channel));
  const countryByCode = new Map(countries.map((c) => [c.code, c]));

  const streamsByChannel = new Map<string, SourceStream[]>();
  for (const s of streams) {
    if (!s.channel || !s.url) continue;
    if (!/^https?:\/\//i.test(s.url)) continue;
    const list = streamsByChannel.get(s.channel) ?? [];
    list.push(s);
    streamsByChannel.set(s.channel, list);
  }

  // Prefer the largest logo available per channel.
  const logoByChannel = new Map<string, SourceLogo>();
  for (const l of logos) {
    const current = logoByChannel.get(l.channel);
    if (!current || (l.width ?? 0) > (current.width ?? 0)) {
      logoByChannel.set(l.channel, l);
    }
  }

  const mainFeedIds = new Set(
    feeds.filter((f) => f.is_main).map((f) => `${f.channel}@${f.id}`),
  );
  void mainFeedIds; // reserved: feed-level selection is not used for grouping yet

  const rejectionReasons: Record<string, number> = {};
  const reject = (reason: string) => {
    rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
  };

  const approved: ApprovedChannel[] = [];

  for (const channel of channels) {
    // --- hard exclusions -------------------------------------------------
    if (blocked.has(channel.id)) {
      reject('iptv-org blocklist');
      continue;
    }
    if (channel.is_nsfw && !INCLUDE_NSFW) {
      reject('NSFW');
      continue;
    }
    if (channel.closed || channel.replaced_by) {
      reject('closed or replaced');
      continue;
    }

    if (MODE === 'public') {
      const denied = channel.categories.filter((c) =>
        DENIED_CATEGORIES.includes(c),
      );
      if (denied.length > 0) {
        reject(`denied category: ${denied[0]}`);
        continue;
      }

      const brandHit = matchesDeniedBrand(
        channel.name,
        channel.network,
        ...channel.alt_names,
        ...channel.owners,
      );
      if (brandHit) {
        reject('denied brand / commercial group');
        continue;
      }
    }

    // --- explicit allowlist ----------------------------------------------
    // In open mode a channel without a basis is still listed, but it is
    // labelled unverified rather than given a basis it has not earned.
    const licensing =
      findLicensingBasis(channel) ??
      (MODE === 'open'
        ? {
            basis: 'unverified-open-mode' as LicensingBasis,
            evidence: 'Not checked — open mode lists the full iptv-org catalogue',
          }
        : null);
    if (!licensing) {
      reject('no verifiable public/free-to-air licensing basis');
      continue;
    }

    // --- playability -------------------------------------------------------
    const raw = streamsByChannel.get(channel.id) ?? [];
    const playable = raw
      .filter((s) => !s.user_agent && !s.referrer)
      .map<ApprovedStream>((s) => ({
        url: s.url,
        quality: s.quality,
        needsCustomHeaders: false,
      }));

    // De-duplicate identical URLs.
    const seen = new Set<string>();
    const uniqueStreams = playable.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    if (uniqueStreams.length === 0) {
      reject('no browser-playable stream');
      continue;
    }

    const country = countryByCode.get(channel.country);
    const logo = logoByChannel.get(channel.id);

    approved.push({
      id: channel.id,
      name: channel.name,
      country: channel.country,
      countryName: country?.name ?? channel.country,
      countryFlag: country?.flag ?? '🏳️',
      categories: channel.categories,
      primaryCategory: channel.categories[0] ?? 'general',
      owners: channel.owners,
      network: channel.network,
      website: channel.website,
      logo: logo?.url ?? null,
      streams: uniqueStreams,
      licensing: {
        basis: licensing.basis,
        label: BASIS_LABELS[licensing.basis],
        explanation: BASIS_EXPLANATIONS[licensing.basis],
        evidence: licensing.evidence,
        source: 'https://iptv-org.github.io/api/channels.json',
      },
    });
  }

  approved.sort((a, b) =>
    a.countryName === b.countryName
      ? a.name.localeCompare(b.name)
      : a.countryName.localeCompare(b.countryName),
  );

  const dataset: ApprovedDataset = {
    generatedAt: new Date().toISOString(),
    mode: MODE,
    policyVersion: POLICY_VERSION,
    source: 'https://iptv-org.github.io/api',
    counts: {
      sourceChannels: channels.length,
      approved: approved.length,
      rejected: channels.length - approved.length,
    },
    rejectionReasons,
    channels: approved,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(dataset, null, 2) + '\n', 'utf8');

  console.log(
    `\n${MODE === 'open' ? 'Listed' : 'Approved'} ${approved.length} of ${channels.length} channels.`,
  );
  console.log('Top rejection reasons:');
  Object.entries(rejectionReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([reason, count]) => console.log(`  ${count.toString().padStart(6)}  ${reason}`));
  console.log(`\nWrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
