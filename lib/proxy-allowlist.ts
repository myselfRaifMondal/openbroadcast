import dataset from '@/data/channels.approved.json';
import type { ApprovedDataset } from '@/scripts/filter-channels';

const data = dataset as unknown as ApprovedDataset;

/**
 * Server-only lookups backing /api/manifest.
 *
 * The proxy will only fetch a URL that the build already put in the catalogue,
 * and only with the headers iptv-org recorded for that exact stream. Both maps
 * are derived from the committed dataset, so the endpoint cannot be pointed at
 * anything the site does not already list.
 */

export interface StreamHeaders {
  userAgent: string | null;
  referrer: string | null;
}

let hosts: Set<string> | null = null;
let headersByUrl: Map<string, StreamHeaders> | null = null;

function build() {
  if (hosts && headersByUrl) return;
  const h = new Set<string>();
  const m = new Map<string, StreamHeaders>();

  for (const channel of data.channels) {
    for (const stream of channel.streams) {
      if (!stream.needsCustomHeaders) continue;
      try {
        h.add(new URL(stream.url).hostname.toLowerCase());
      } catch {
        continue;
      }
      m.set(stream.url, {
        userAgent: stream.userAgent ?? null,
        referrer: stream.referrer ?? null,
      });
    }
  }

  hosts = h;
  headersByUrl = m;
}

/**
 * A URL may be proxied when its host serves at least one header-gated stream in
 * the catalogue. Host rather than exact URL, because a master playlist points
 * at variant playlists on the same origin that also need the headers.
 */
export function isProxyableUrl(url: URL) {
  build();
  return hosts!.has(url.hostname.toLowerCase());
}

/**
 * Headers for an exact stream URL. Variant playlists discovered at runtime have
 * no entry, so they fall back to the headers of any stream on the same host —
 * which is where they came from.
 */
export function getStreamHeaders(url: string): StreamHeaders | undefined {
  build();
  const exact = headersByUrl!.get(url);
  if (exact) return exact;

  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [known, headers] of headersByUrl!) {
      if (new URL(known).hostname.toLowerCase() === host) return headers;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

/** The client-side path for a stream that needs headers. */
export function manifestUrl(streamUrl: string) {
  return `/api/manifest?u=${encodeURIComponent(streamUrl)}`;
}
