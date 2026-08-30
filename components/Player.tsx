'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApprovedStream } from '@/lib/channels';

type Status = 'tuning' | 'on-air' | 'no-signal';

export function Player({
  streams,
  name,
}: {
  streams: ApprovedStream[];
  name: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('tuning');
  const [message, setMessage] = useState<string | null>(null);

  const stream = streams[index];
  // Past a handful, repeated "1080p" labels stop distinguishing anything, so
  // the feeds get numbered and the quality moves to the selected one.
  const dense = streams.length > 6;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;

    setStatus('tuning');
    setMessage(null);

    // A channel often lists many mirrors of the same feed and the first is
    // frequently dead, so walk to the next one rather than making the viewer
    // click through them. Only give up once every feed has been tried.
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
        video.addEventListener('loadedmetadata', () => {
          if (cancelled) return;
          setStatus('on-air');
          void video.play().catch(() => {});
        }, { once: true });
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
      video.removeAttribute('src');
      video.load();
    };
  }, [stream, index, streams.length]);

  if (!stream) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-line bg-panel">
        <span aria-hidden className="testcard h-20 w-32 rounded-md" />
      </div>
    );
  }

  return (
    <div>
      <div className="scanlines relative overflow-hidden rounded-xl border border-line bg-black">
        <video
          ref={videoRef}
          controls={status === 'on-air'}
          playsInline
          autoPlay
          className="aspect-video w-full bg-black"
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
          {dense && (
            <span className="ml-1 font-mono text-[10.5px] text-faint">
              {streams[index]?.quality ?? ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
