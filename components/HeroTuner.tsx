'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { HeroCandidate } from '@/lib/channels';

type State = 'tuning' | 'on-air' | 'no-signal';

/**
 * The thesis of the page: it opens on live television, muted, already playing.
 * If the pick fails it walks to the next candidate rather than sitting on an
 * error, the way a tuner scans past a dead frequency.
 */
export function HeroTuner({
  candidates,
  channelCount,
  countryCount,
}: {
  candidates: HeroCandidate[];
  channelCount: number;
  countryCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<State>('tuning');

  // Start somewhere different on each visit. The pick has to happen after
  // mount: choosing during render would make the server and client disagree
  // about which channel the hero names.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIndex(Math.floor(Math.random() * candidates.length)), [
    candidates.length,
  ]);

  const current = candidates[index];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    setState('tuning');

    const scanOn = () => {
      if (cancelled) return;
      setState('no-signal');
      // Give the still frame a beat before moving to the next frequency.
      window.setTimeout(() => {
        if (!cancelled) setIndex((i) => (i + 1) % candidates.length);
      }, 1400);
    };

    async function attach() {
      const { default: Hls } = await import('hls.js');
      if (cancelled || !video) return;

      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls = instance;
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) scanOn();
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setState('on-air');
          void video.play().catch(() => {});
        });
        instance.loadSource(current.url);
        instance.attachMedia(video);
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = current.url;
        video.addEventListener('loadedmetadata', () => {
          if (cancelled) return;
          setState('on-air');
          void video.play().catch(() => {});
        }, { once: true });
        video.addEventListener('error', scanOn, { once: true });
        return;
      }
      scanOn();
    }

    void attach();
    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [current, candidates.length]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel">
      {/* Picture layer. Absolute so the panel is sized by its copy, which on a
          phone is taller than any fixed aspect ratio would allow. */}
      <div className="scanlines absolute inset-0 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="h-full w-full object-cover opacity-70"
        />
        {state !== 'on-air' && <div className="testcard absolute inset-0" aria-hidden />}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/20"
        />
      </div>

      <div className="relative flex min-h-[360px] flex-col justify-end p-6 sm:min-h-[440px] sm:p-10 lg:min-h-[500px]">
        <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: state === 'on-air' ? 'var(--live)' : 'var(--bar-yellow)',
              boxShadow: `0 0 10px ${state === 'on-air' ? 'var(--live)' : 'var(--bar-yellow)'}`,
            }}
          />
          {state === 'on-air'
            ? 'On air'
            : state === 'no-signal'
              ? 'No signal — scanning'
              : 'Tuning'}
        </p>

        <h1 className="mt-3 max-w-3xl font-display text-[32px] font-extrabold leading-[0.95] tracking-[-0.02em] sm:text-[52px]">
          Everything that is
          <br />
          on right now.
        </h1>

        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
          <p className="font-mono text-[12px] text-dim">
            <span className="text-[22px] font-medium text-text">
              {channelCount.toLocaleString()}
            </span>{' '}
            channels
          </p>
          <p className="font-mono text-[12px] text-dim">
            <span className="text-[22px] font-medium text-text">{countryCount}</span>{' '}
            countries
          </p>
          {current && (
            <Link
              href={`/channel/${encodeURIComponent(current.id)}`}
              className="flex items-center gap-3 rounded-full border border-line bg-ink/70 py-1.5 pl-2 pr-4 backdrop-blur transition-colors hover:border-cyan/60 sm:ml-auto"
            >
              <span className="bars h-6 w-1.5 rounded-full" aria-hidden />
              <span className="text-left">
                <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  {current.countryFlag} {current.countryName}
                </span>
                <span className="block text-[13px] font-medium">{current.name}</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
