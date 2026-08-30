'use client';

import { useEffect, useRef, useState } from 'react';
import { categoryColor } from '@/lib/channels';

/**
 * Falls back to the channel's initials on a bar-coloured plate, so a missing
 * logo still reads as a station ident rather than a broken image.
 */
export function ChannelLogo({
  src,
  name,
  category,
  size = 'md',
}: {
  src: string | null;
  name: string;
  category: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const box = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={`${box} grid shrink-0 place-items-center rounded-[5px] font-display text-[13px] font-bold`}
        style={{
          background: `color-mix(in srgb, ${categoryColor(category)} 14%, var(--raise))`,
          color: categoryColor(category),
        }}
      >
        {name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '··'}
      </span>
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
      className={`${box} shrink-0 rounded-[5px] bg-raise object-contain p-1.5`}
    />
  );
}
