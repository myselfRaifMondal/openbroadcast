'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApprovedStream } from '@/lib/channels';

type Status = 'idle' | 'loading' | 'playing' | 'error';

export function Player({ streams, name }: { streams: ApprovedStream[]; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const stream = streams[index];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    // hls.js instance type is resolved lazily; `unknown` keeps this SSR-safe.
    let hls: { destroy: () => void } | null = null;

    setStatus('loading');
    setMessage(null);

    const fail = (detail: string) => {
      if (cancelled) return;
      setStatus('error');
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
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            fail(
              'The broadcaster’s stream could not be reached. It may be geo-restricted, offline, or blocking browser playback.',
            );
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            instance.recoverMediaError();
          } else {
            fail('This stream could not be played in the browser.');
          }
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {
            /* autoplay blocked — user can press play */
          });
          if (!cancelled) setStatus('playing');
        });
        instance.loadSource(stream.url);
        instance.attachMedia(video);
        return;
      }

      // Safari and iOS play HLS natively.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.addEventListener(
          'loadedmetadata',
          () => {
            if (!cancelled) setStatus('playing');
            void video.play().catch(() => {});
          },
          { once: true },
        );
        video.addEventListener('error', () => fail('This stream could not be played.'), {
          once: true,
        });
        return;
      }

      fail('This browser cannot play HLS streams.');
    }

    void attach();

    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [stream]);

  if (!stream) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-border bg-surface text-[13px] text-muted">
        No playable stream is listed for this channel.
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          muted
          className="aspect-video w-full bg-black"
          aria-label={`Live stream: ${name}`}
        />
        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 text-[13px] text-muted">
            Connecting to {name}…
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 px-6 text-center">
            <div>
              <p className="text-[13.5px]">{message}</p>
              {streams.length > 1 && (
                <p className="mt-2 text-[12px] text-muted">
                  Try another source below.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-muted">
          {streams.length > 1 ? 'Sources:' : 'Source:'}
        </span>
        {streams.map((s, i) => (
          <button
            key={s.url}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-md border px-2 py-1 transition-colors ${
              i === index
                ? 'border-accent/70 bg-surface-2 text-foreground'
                : 'border-border bg-surface text-muted hover:text-foreground'
            }`}
          >
            {s.quality ?? `Source ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}
