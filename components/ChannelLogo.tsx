'use client';

import { useEffect, useRef, useState } from 'react';

export function ChannelLogo({
  src,
  name,
  size = 'md',
}: {
  src: string | null;
  name: string;
  size?: 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const box = size === 'lg' ? 'h-20 w-20' : 'h-12 w-12';

  // The server-rendered <img> can finish (or fail) before hydration attaches
  // onError, so re-check the decoded size once on mount.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${box} shrink-0 grid place-items-center rounded-lg bg-surface-2 text-[13px] font-semibold text-muted`}
        aria-hidden
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} shrink-0 rounded-lg bg-surface-2 object-contain p-1.5`}
    />
  );
}
