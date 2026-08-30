#!/usr/bin/env bash
# Renders each artboard to an exact-size PNG with headless Chrome.
#
# Chrome is driven at 2x device scale and the result is resampled down to the
# platform's exact pixel size, so type stays sharp instead of being upscaled.
set -euo pipefail

CHROME="${CHROME:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell}"
PORT="${PORT:-4199}"
OUT="$(cd "$(dirname "$0")" && pwd)/out"
mkdir -p "$OUT"

render() { # name width height
  local name=$1 w=$2 h=$3
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 \
    --window-size="$w,$h" \
    --screenshot="$OUT/$name.png" \
    "http://localhost:$PORT/$name.html" >/dev/null 2>&1
  sips -z "$h" "$w" "$OUT/$name.png" >/dev/null
  echo "  $name.png  ${w}x${h}"
}

echo "Rendering OpenBroadcast social assets:"
render ig-feed          1080 1350   # Instagram feed, 4:5
render ig-story         1080 1920   # Instagram / Facebook story, 9:16
render linkedin         1200  627   # LinkedIn single-image post
render whatsapp-status  1080 1920   # WhatsApp status, 9:16
render square           1080 1080   # Profile picture / square post
echo "Done -> $OUT"
