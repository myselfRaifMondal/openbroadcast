'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApprovedStream } from '@/lib/channels';

type Status = 'tuning' | 'on-air' | 'no-signal';

/**
 * Drift past this point counts as no longer live.
 *
 * This is measured against the player's live-sync position, NOT the end of the
 * manifest. Healthy HLS playback sits ~15-20s behind the manifest edge by
 * design (it buffers whole segments), so comparing against the edge labels a
 * perfectly live stream as "behind".
 */
const DRIFT_SECONDS = 10;

/** Assumed latency when the browser plays HLS natively and hls.js is not driving it. */
const NATIVE_LATENCY = 20;

export function Player({
  streams,
  name,
}: {
  streams: ApprovedStream[];
  name: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  // hls.js reports null when it has no live edge yet, so the ref mirrors that
  // rather than pretending the field is optional.
  const hlsRef = useRef<{
    destroy: () => void;
    liveSyncPosition?: number | null;
  } | null>(null);

  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('tuning');
  const [message, setMessage] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [behind, setBehind] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const stream = streams[index];
  const dense = streams.length > 6;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;

    setStatus('tuning');
    setMessage(null);

    // A channel often lists many mirrors of the same feed and the first is
    // frequently dead, so walk to the next rather than making the viewer click
    // through them. Only give up once every feed has been tried.
    const fail = (detail: string) => {
      if (cancelled) return;
      if (index < streams.length - 1) {
        setIndex(index + 1);
        return;
      }
      setStatus('no-signal');
      setMessage(detail);
    };

    async function attach() {
      const { default: Hls } = await import('hls.js');
      if (cancelled || !video) return;

      if (Hls.isSupported()) {
        const instance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hls = instance;
        hlsRef.current = instance;
        instance.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            instance.recoverMediaError();
            return;
          }
          fail(
            streams.length > 1
              ? `None of the ${streams.length} feeds for this channel responded. It may be off air, or restricted to its own country.`
              : 'This feed is not responding. It may be off air, or restricted to its own country.',
          );
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setStatus('on-air');
          void video.play().catch(() => {});
        });
        instance.loadSource(stream.url);
        instance.attachMedia(video);
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.addEventListener(
          'loadedmetadata',
          () => {
            if (cancelled) return;
            setStatus('on-air');
            void video.play().catch(() => {});
          },
          { once: true },
        );
        video.addEventListener('error', () => fail('This feed is not responding.'), {
          once: true,
        });
        return;
      }

      fail('This browser cannot play HLS video.');
    }

    void attach();
    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [stream, index, streams.length]);

  // Track how far behind the live edge we have drifted. That is the only
  // position a broadcast has that means anything, which is why this player
  // has no progress bar and no duration.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };
    const onProgress = () => {
      const seekable = video.seekable;
      if (seekable.length === 0) return;
      const edge = seekable.end(seekable.length - 1);
      const sync = hlsRef.current?.liveSyncPosition;
      const target = typeof sync === 'number' ? sync : edge - NATIVE_LATENCY;
      setBehind(Math.max(0, target - video.currentTime));
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('timeupdate', onProgress);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('timeupdate', onProgress);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const goLive = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const live = hlsRef.current?.liveSyncPosition;
    if (typeof live === 'number') {
      video.currentTime = live;
    } else if (video.seekable.length > 0) {
      video.currentTime = video.seekable.end(video.seekable.length - 1);
    }
    void video.play().catch(() => {});
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    // Unmuting at zero volume looks broken, so give it something to play.
    if (!video.muted && video.volume === 0) video.volume = 0.6;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm') {
        toggleMute();
      } else if (e.key === 'f') {
        toggleFullscreen();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute, toggleFullscreen]);

  if (!stream) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-line bg-panel">
        <span aria-hidden className="testcard h-20 w-32 rounded-md" />
      </div>
    );
  }

  const atLive = behind < DRIFT_SECONDS;

  return (
    <div>
      <div
        ref={shellRef}
        className="scanlines group relative overflow-hidden rounded-xl border border-line bg-black"
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted={muted}
          onClick={togglePlay}
          className="aspect-video w-full cursor-pointer bg-black"
          aria-label={`Live stream: ${name}`}
        />

        {status === 'tuning' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/70">
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden className="bars h-1.5 w-24 animate-pulse rounded-full" />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
                Tuning
              </p>
            </div>
          </div>
        )}

        {status === 'no-signal' && (
          <div className="absolute inset-0 grid place-items-center bg-ink px-6">
            <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
              <span
                aria-hidden
                className="testcard aspect-[4/3] w-full max-w-[260px] rounded-lg"
              />
              <div>
                <p className="font-display text-[15px] font-bold uppercase tracking-[0.22em]">
                  No signal
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-dim">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live controls: no scrubber, no duration, because a broadcast has
            neither. The live edge is the only position worth showing. */}
        {status === 'on-air' && (
          <div
            className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10 transition-opacity duration-200 ${
              playing
                ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                : 'opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text transition-colors hover:bg-white/10"
            >
              {playing ? (
                <svg width="13" height="15" viewBox="0 0 13 15" aria-hidden>
                  <rect width="4" height="15" rx="1" fill="currentColor" />
                  <rect x="9" width="4" height="15" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
                  <path
                    d="M1 1.7v12.6a1 1 0 0 0 1.5.87l11-6.3a1 1 0 0 0 0-1.74l-11-6.3A1 1 0 0 0 1 1.7Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={atLive ? undefined : goLive}
              aria-label={atLive ? 'Playing live' : 'Jump to live'}
              disabled={atLive}
              className={`flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors ${
                atLive ? 'cursor-default text-text' : 'bg-white/10 text-dim hover:text-text'
              }`}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: atLive ? 'var(--live)' : 'var(--faint)',
                  boxShadow: atLive ? '0 0 8px var(--live)' : 'none',
                }}
              />
              {atLive ? 'Live' : `Go live · ${Math.round(behind)}s behind`}
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="grid h-9 w-9 place-items-center rounded-full text-text transition-colors hover:bg-white/10"
              >
                <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
                  <path d="M1 5.5h3L8 2v12L4 10.5H1z" fill="currentColor" />
                  {muted || volume === 0 ? (
                    <path
                      d="M11.5 5.5l5 5m0-5l-5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path
                        d="M11 5a4.2 4.2 0 0 1 0 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <path
                        d="M13.4 2.6a7.6 7.6 0 0 1 0 10.8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        opacity=".7"
                      />
                    </>
                  )}
                </svg>
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.volume = Number(e.target.value);
                  video.muted = Number(e.target.value) === 0;
                }}
                aria-label="Volume"
                className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--bar-cyan)] sm:block"
              />
            </div>

            <span className="ml-auto shrink-0 font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
              {stream.quality ?? 'Auto'}
            </span>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text transition-colors hover:bg-white/10"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              >
                {fullscreen ? <path d="M6 1v5H1M10 15v-5h5" /> : <path d="M1 6V1h5M15 10v5h-5" />}
              </svg>
            </button>
          </div>
        )}
      </div>

      {streams.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
            {dense ? 'Feeds' : 'Sources'}
          </span>
          {streams.map((s, i) => (
            <button
              key={s.url}
              type="button"
              onClick={() => setIndex(i)}
              title={s.quality ? `Feed ${i + 1} — ${s.quality}` : `Feed ${i + 1}`}
              aria-label={s.quality ? `Feed ${i + 1}, ${s.quality}` : `Feed ${i + 1}`}
              className={`rounded-md border font-mono text-[11px] transition-colors ${
                dense ? 'h-7 w-7' : 'px-2.5 py-1'
              } ${
                i === index
                  ? 'border-cyan/60 bg-raise text-text'
                  : 'border-line text-dim hover:text-text'
              }`}
            >
              {dense ? i + 1 : (s.quality ?? i + 1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
