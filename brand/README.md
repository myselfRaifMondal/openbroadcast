# OpenBroadcast — social assets

Advertising images for Instagram, LinkedIn, and WhatsApp, built from the same
tokens as the product (`app/globals.css`) so the marketing and the site are
demonstrably the same brand: SMPTE colour bars, Archivo for display, IBM Plex
Sans/Mono for body and data, and the scanline wash.

## Assets

| File | Size | Where it goes |
| --- | --- | --- |
| `out/ig-feed.png` | 1080×1350 | Instagram feed (4:5, the tallest the feed allows) |
| `out/ig-story.png` | 1080×1920 | Instagram / Facebook story, 9:16 |
| `out/linkedin.png` | 1200×627 | LinkedIn single-image post and link preview |
| `out/whatsapp-status.png` | 1080×1920 | WhatsApp status, 9:16 |
| `out/square.png` | 1080×1080 | Profile picture, WhatsApp DP, square post |

## Re-rendering

```bash
python3 -m http.server 4199    # from this directory
./render.sh
```

`render.sh` drives the Chromium that Playwright already caches — no extra
dependency — at 2× device scale, then resamples down to the exact platform
size so the type stays sharp rather than being upscaled.

Edit the `.html` artboards to change copy; they share `_base.css`.

## Two deliberate constraints

**No broadcaster logos or channel screenshots.** The wall of screens is
abstract. Putting the BBC's or Al Jazeera's marks in an advert for this site
would imply an affiliation or endorsement that does not exist, whatever the
underlying streams are.

**Every number is real.** 7,648 channels and 174 countries come from
`data/channels.approved.json` after dead streams were pruned. If the catalogue
is re-filtered, update the copy in the artboards — a stale count in an advert
is a false claim, not a rounding error.
