'use client';

import Link from 'next/link';
import type { BrowseChannel } from '@/lib/channels';
import { ChannelLogo } from './ChannelLogo';

/** A horizontally scrolling shelf, the unit a streaming front page is made of. */
export function ChannelRow({
  label,
  items,
  accent,
}: {
  label: string;
  items: BrowseChannel[];
  accent: string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2.5 flex items-center gap-2.5">
        <span aria-hidden className="h-3.5 w-1 rounded-full" style={{ background: accent }} />
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.16em]">
          {label}
        </span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-line" />
      </h2>

      <ul className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
        {items.map((c) => (
          <li key={c.id} className="w-[172px] shrink-0 snap-start">
            <Link
              href={`/channel/${encodeURIComponent(c.id)}`}
              className="group block overflow-hidden rounded-lg border border-line bg-panel transition-colors hover:bg-raise"
            >
              <span className="scanlines relative flex aspect-video items-center justify-center bg-black">
                <ChannelLogo
                  src={c.logo}
                  name={c.name}
                  category={c.primaryCategory}
                  size="lg"
                />
                <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text backdrop-blur">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-live shadow-[0_0_8px_var(--live)]"
                  />
                  Live
                </span>
              </span>
              <span className="block px-3 py-2">
                <span className="block truncate text-[13px] font-medium">{c.name}</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                  {c.countryFlag} {c.countryName}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
