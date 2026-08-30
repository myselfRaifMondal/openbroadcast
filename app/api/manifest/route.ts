import { lookup } from 'node:dns/promises';
import { getStreamHeaders, isProxyableUrl } from '@/lib/proxy-allowlist';

/**
 * Fetches an HLS playlist that its origin will only serve with a particular
 * user-agent or referer — headers a browser cannot set on a media request.
 *
 * Only the playlist passes through here. Segment URIs are rewritten to
 * absolute origin URLs, so the video itself streams directly from the
 * broadcaster and never touches this deployment.
 *
 * This endpoint takes a URL from the query string, so it is an SSRF target by
 * construction. Three things keep it safe, and all three must hold:
 *   1. the host must appear in the built catalogue (no arbitrary destinations),
 *   2. it must resolve to a public IP (no localhost, no cloud metadata, no RFC1918),
 *   3. redirects are not followed, so a permitted host cannot bounce us elsewhere.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Playlists are tens of KB at most; anything larger is not a playlist. */
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;

function isPrivateAddress(address: string, family: number) {
  if (family === 6) {
    const v6 = address.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local
    if (v6.startsWith('fe80')) return true; // link-local
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1], 4);
    return false;
  }

  const [a, b] = address.split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

async function resolvesToPublicAddress(hostname: string) {
  try {
    const results = await lookup(hostname, { all: true });
    return (
      results.length > 0 &&
      results.every((r) => !isPrivateAddress(r.address, r.family))
    );
  } catch {
    return false;
  }
}

/**
 * Rewrites every URI in the playlist to an absolute URL against the playlist's
 * own address, so the player fetches segments straight from the origin.
 * Nested playlists (a master pointing at variants) come back through here,
 * since those need the headers too.
 */
function rewrite(body: string, base: string, self: URL) {
  const proxied = (target: string) =>
    `${self.origin}/api/manifest?u=${encodeURIComponent(target)}`;

  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        // Keys and media playlists appear inside attribute lists.
        return trimmed.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
          const abs = new URL(uri, base).toString();
          return `URI="${/\.m3u8(\?|$)/i.test(abs) ? proxied(abs) : abs}"`;
        });
      }

      const abs = new URL(trimmed, base).toString();
      return /\.m3u8(\?|$)/i.test(abs) ? proxied(abs) : abs;
    })
    .join('\n');
}

export async function GET(request: Request) {
  const self = new URL(request.url);
  const target = self.searchParams.get('u');
  if (!target) {
    return new Response('Missing stream', { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response('Malformed stream address', { status: 400 });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400 });
  }
  if (!isProxyableUrl(url)) {
    return new Response('Stream is not in this catalogue', { status: 403 });
  }
  if (!(await resolvesToPublicAddress(url.hostname))) {
    return new Response('Stream does not resolve to a public address', {
      status: 403,
    });
  }

  const headers: Record<string, string> = { accept: '*/*' };
  const stored = getStreamHeaders(url.toString());
  if (stored?.userAgent) headers['user-agent'] = stored.userAgent;
  if (stored?.referrer) {
    headers.referer = stored.referrer;
    try {
      headers.origin = new URL(stored.referrer).origin;
    } catch {
      /* a malformed referrer in the source data is not worth failing over */
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response('Stream redirected off the catalogue', { status: 502 });
    }
    if (!upstream.ok) {
      return new Response('Stream is not responding', { status: 502 });
    }

    const size = Number(upstream.headers.get('content-length') ?? 0);
    if (size > MAX_BYTES) {
      return new Response('Response too large for a playlist', { status: 502 });
    }

    const body = await upstream.text();
    if (body.length > MAX_BYTES || !body.includes('#EXTM3U')) {
      return new Response('Not an HLS playlist', { status: 502 });
    }

    return new Response(rewrite(body, upstream.url || url.toString(), self), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apple.mpegurl',
        // A live playlist is stale within seconds; caching it any longer
        // stalls playback.
        'cache-control': 'public, max-age=2',
      },
    });
  } catch {
    return new Response('Stream is not responding', { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
