# OpenBroadcast

Live TV from public-service broadcasters, governments, and civic bodies — and
nothing else.

OpenBroadcast is a Next.js app that plays free-to-air and openly published live
streams drawn from the [iptv-org](https://github.com/iptv-org/iptv) open
dataset. It does **not** mirror that dataset. A build-time filter admits a
channel only when a named, checkable rule says it is public-service,
government, or civic, and every channel page states which rule applied.

**Current snapshot: 7,648 channels across 174 countries — the open
catalogue, pruned to those whose streams still respond.**

OpenBroadcast hosts no video. Playback is a direct browser connection to the
broadcaster's own HLS endpoint.

---


## Re-running / updating the approved list

```bash
npm run filter:channels
```

This fetches `channels.json`, `streams.json`, `feeds.json`, `countries.json`,
`logos.json`, and `blocklist.json` from `https://iptv-org.github.io/api`,
applies the policy, and rewrites `data/channels.approved.json`.

That file is **committed to the repo** and imported at build time. The app never
calls iptv-org at request time and never hotlinks GitHub raw content on a page
load — every page under `/channel/[id]` is statically prerendered from the
committed snapshot.

Re-run it whenever you want a fresher snapshot, then commit the diff. Review
the diff: a jump in approvals usually means a new owner string slipped past
review rather than a genuinely new public broadcaster.

### Open mode (personal catalogue)

```bash
npm run filter:open        # POLICY_MODE=open
INCLUDE_NSFW=1 npm run filter:open   # also keep adult channels
```

Open mode skips the licensing policy entirely and lists **every** channel
iptv-org carries a browser-playable stream for — currently **9,316 channels
across 177 countries** before
pruning dead streams, including the sports, movie, entertainment, and pay-TV
brands the public build excludes. It still drops dead channels, channels with
no playable stream, and (unless `INCLUDE_NSFW=1`) adult channels.

Channels that match no allow rule are labelled **"No verified licensing basis
(open mode)"** on their page rather than being given a basis they have not
earned, the header carries an `OPEN MODE` badge, and `/policy` explains that
the policy below it is not being applied.

This is for a private, local catalogue. Nothing about a stream being reachable
means it is licensed for redistribution.

**This repo currently tracks the open catalogue**, at the owner's explicit
request, and the deployed site serves it publicly. Channels with no verified
basis are labelled as such in the UI rather than being passed off as
public-service. To switch the tracked snapshot back to the curated build:

```bash
npm run filter:open && npm run check:streams -- --prune   # build it
cp data/channels.approved.json data/channels.open.local.json  # keep it
cp data/channels.open.local.json data/channels.approved.json  # swap it back in
npm run filter:channels                                    # return to curated
```

### Pruning dead streams

```bash
npm run check:streams            # probe and report only
npm run check:streams -- --prune # also drop unreachable channels
```

The filter only checks that a stream URL exists — never that it answers, and
iptv-org endpoints rot continuously. This probes every stream and classifies
each channel:

- **live** — the manifest came back with `#EXTM3U`.
- **geo-blocked** — HTTP 403/451. The stream is healthy, the broadcaster just
  fences it to its own country. **Never pruned**: it plays from in-country or
  over a VPN. Public broadcasters do this far more than commercial channels.
- **dead** — 404, DNS/connection failure, timeout, or a response that is not an
  HLS manifest.

Probing runs in two passes. The first is fast (10s timeout, 64 concurrent);
everything that fails is then retried alone at 20s and 40-way concurrency,
because a slow stream under load looks identical to a dead one. On the run
below that retry recovered **296 of 1,964** apparent failures (15%) — pruning
on a single pass would have deleted working channels.

Last run on the open catalogue: **7,108 live, 540 geo-blocked, 1,668 pruned**
(9,316 → 7,648 channels across 174 countries). Results are written to
`data/stream-health.json`, and `--prune` records the summary on the dataset as
`streamHealth`.

Health is a snapshot, not a property of the catalogue — re-run it periodically
and re-prune.

### Finding new candidates

```bash
npm run audit:candidates [minChannels]
```

Lists every owner whose channels clear all the hard exclusions and have a
playable stream, but match no inclusion rule — the review queue for the
allowlist. Nothing is admitted automatically: an owner earns a place in
`PUBLIC_BROADCASTER_OWNERS` only after a human confirms it is a public-service,
state, or civic broadcaster. Channels with no owner listed upstream at all
(~3,500 of them) stay excluded, since there is nothing to verify.

### Changing the policy

Edit `scripts/policy.ts`:

- `PUBLIC_BROADCASTER_OWNERS` — add an owner **exactly** as it appears in
  iptv-org's `channels.json`.
- `GOVERNMENT_OWNER_PATTERNS` — regexes matched against the whole owner string.
- `DENIED_CATEGORIES` / `DENIED_BRAND_PATTERNS` — the hard exclusions.

Bump `POLICY_VERSION` in `scripts/filter-channels.ts`, re-run the filter, and
commit both the policy change and the regenerated data file.

---

## Development

```bash
npm install
npm run filter:channels   # regenerate data/channels.approved.json (optional)
npm run dev               # http://localhost:3000
npm run build             # static prerender of every channel page
```

## Stack

- **Next.js 16** (App Router, TypeScript) — every route is statically prerendered
- **hls.js** for HLS playback, with native HLS on Safari/iOS
- **Tailwind CSS v4**
- Static JSON as the only data store — no database, no runtime API

Deployed on Vercel's free Hobby tier. The repo is connected to the Vercel
project, so a push to `main` deploys to production and any other branch gets a
preview URL. The deployed site is public and unauthenticated, and currently
serves the open catalogue — see **Open mode** below.

## Project layout

```
app/
  page.tsx              home — live hero, genre shelves, full browse grid
  channel/[id]/page.tsx player, channel ident, recommendations rail
components/
  Sidebar.tsx           left rail of the most widely carried channels
  ChannelRow.tsx        horizontally scrolling genre shelf
  HeroTuner.tsx         the front page opens on a live channel, and scans past dead ones
  ChannelBrowser.tsx    search, country filter, genre chips, grouped grid
  Player.tsx            hls.js player that walks past dead feeds automatically
  ChannelLogo.tsx       logo with a bar-coloured initials fallback
lib/channels.ts         typed accessors over the approved dataset
scripts/
  policy.ts             the allowlist / denylist policy
  filter-channels.ts    fetch → filter → data/channels.approved.json
data/
  channels.approved.json committed build-time snapshot
```

## Contributing

Think a channel here does not belong, or a public broadcaster is missing?
[Open an issue](https://github.com/myselfRaifMondal/openbroadcast/issues) with
the iptv-org channel id. Additions need a citable basis — a statute, charter,
or the broadcaster's own statement that the service is free-to-air.

## Licence

Code: MIT. Channel metadata and logos come from iptv-org and remain under their
respective licences. Streams belong to the broadcasters.
