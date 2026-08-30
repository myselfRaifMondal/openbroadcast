# OpenBroadcast

Live TV from public-service broadcasters, governments, and civic bodies — and
nothing else.

OpenBroadcast is a Next.js app that plays free-to-air and openly published live
streams drawn from the [iptv-org](https://github.com/iptv-org/iptv) open
dataset. It does **not** mirror that dataset. A build-time filter admits a
channel only when a named, checkable rule says it is public-service,
government, or civic, and every channel page states which rule applied.

**Current snapshot: 781 channels across 104 countries, filtered from 40,834
source entries.**

OpenBroadcast hosts no video. Playback is a direct browser connection to the
broadcaster's own HLS endpoint.

---

## Filtering policy

The iptv-org dataset has no per-channel licensing field. So the policy is an
**allowlist, not a blocklist**: the pipeline starts from zero channels and
admits one only on a positive, named ground. Anything ambiguous or
unrecognised is excluded — "probably fine" is not a ground for inclusion.

The policy lives in [`scripts/policy.ts`](scripts/policy.ts) and is applied by
[`scripts/filter-channels.ts`](scripts/filter-channels.ts).

### Grounds for inclusion (a channel must match at least one)

| Basis | Rule |
| --- | --- |
| `public-service-category` | iptv-org tags the channel with its `public` category, reserved for free-to-air public-service broadcasters. |
| `legislative-category` | iptv-org tags the channel with its `legislative` category — parliamentary, municipal, and civic-government feeds. |
| `public-broadcaster-owner` | An owner string matches the reviewed allowlist of national public-service broadcasters (BBC, PBS, ARD, ZDF, NHK, France Télévisions, RTVE, ABC Australia, CBC, SVT, NRK, Yle, TRT, SABC, Prasar Bharati, …). **Exact string match only** — a near-miss counts as unverified. |
| `government-owner` | An owner string matches a reviewed government / public-authority pattern (`Government of …`, `Ministry of …`, `City of …`, `… Public Broadcasting`, national state broadcasting companies, public university and community-college districts). |

The matched basis, and the exact source value that triggered it, are stored on
every approved channel and shown in the "Why is this channel here?" panel on
its page.

### Hard exclusions (applied after every allow rule — these always win)

- **Excluded categories:** sports, movies, series, xxx, shop, entertainment,
  comedy, animation, music, lifestyle, relax, auto, outdoor, travel, cooking,
  family, classic, interactive.
- **Premium / pay-TV brands**, matched against channel name, network, alternate
  names, and owners: ESPN, Sky, beIN, DAZN, PPV and pay-per-view, HBO,
  Showtime, Starz, Cinemax, Paramount/Viacom, Warner Bros. Discovery, Disney,
  Fox, NBC/CNBC/MSNBC/Telemundo, Comcast, AMC Networks, TNT, CNN, Star, Zee,
  Sony, Hallmark, MTV, Nickelodeon, Pluto, Nexstar, Sinclair, Gray, Scripps,
  Viaplay, Canal+, OSN, and the major sports leagues (MLB, NBA, NFL, NHL, UEFA,
  FIFA, F1, WWE, UFC, SuperSport, Eurosport).
- **iptv-org blocklist and NSFW flags** — every entry iptv-org marks for a
  rights complaint or adult content.
- **Closed or replaced channels.**
- **Streams that cannot be played from a browser** — sources requiring a
  spoofed `user-agent` or `referrer` are dropped rather than worked around.
- **No verifiable basis** — if none of the four inclusion rules fires, the
  channel is excluded. By design this is the largest exclusion bucket.

### What the current run excluded

| Reason | Channels |
| --- | --- |
| no verifiable public/free-to-air licensing basis | 20,811 |
| denied category: entertainment | 3,804 |
| denied brand / commercial group | 2,555 |
| denied category: sports | 2,006 |
| denied category: music | 1,807 |
| no browser-playable stream | 1,664 |
| denied category: movies | 1,586 |
| iptv-org blocklist | 1,420 |
| closed or replaced | 1,262 |
| denied category: shop | 696 |
| denied category: series | 676 |
| denied category: lifestyle | 411 |
| denied category: comedy | 341 |
| denied category: animation | 258 |
| denied category: travel | 181 |
| denied category: outdoor | 134 |
| denied category: classic | 113 |
| denied category: family | 100 |
| denied category: cooking | 90 |
| denied category: auto | 72 |
| denied category: relax | 53 |
| NSFW | 10 |
| denied category: interactive | 3 |

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
across 177 countries**, including the sports, movie, entertainment, and pay-TV
brands the public build excludes. It still drops dead channels, channels with
no playable stream, and (unless `INCLUDE_NSFW=1`) adult channels.

Channels that match no allow rule are labelled **"No verified licensing basis
(open mode)"** on their page rather than being given a basis they have not
earned, the header carries an `OPEN MODE` badge, and `/policy` explains that
the policy below it is not being applied.

This is for a private, local catalogue. Nothing about a stream being reachable
means it is licensed for redistribution, so an open-mode build should not be
deployed to a public URL. To go back:

```bash
npm run filter:channels && npm run build
```

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

Deployed on Vercel's free Hobby tier.

## Project layout

```
app/
  page.tsx              home — browsable grid, search, country/category filters
  channel/[id]/page.tsx player page + licensing justification
  policy/page.tsx       the filtering policy, rendered from the live policy module
components/
  ChannelBrowser.tsx    search, filters, grouping by country or category
  Player.tsx            hls.js <video> player with source fallback
  ChannelLogo.tsx       logo with initials fallback
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
