'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { categoryColor, type BrowseChannel } from '@/lib/channels';
import { ChannelLogo } from './ChannelLogo';

const SHOWN = 24;

/**
 * The rail's open/closed state lives in localStorage. Reading it through
 * useSyncExternalStore keeps the server render and the first client render
 * agreeing on a default, without a setState-in-effect flash.
 */
const railListeners = new Set<() => void>();

function subscribeRail(listener: () => void) {
  railListeners.add(listener);
  return () => railListeners.delete(listener);
}

function railIsOpen() {
  try {
    return localStorage.getItem('ob:rail') !== 'closed';
  } catch {
    return true;
  }
}

function railIsOpenOnServer() {
  return true;
}

function setRail(open: boolean) {
  try {
    localStorage.setItem('ob:rail', open ? 'open' : 'closed');
  } catch {
    /* private mode — the choice just does not persist */
  }
  railListeners.forEach((l) => l());
}

/**
 * The left rail, in the shape of a streaming site's channel list. It ranks by
 * how widely a channel is carried, which is the only real popularity signal in
 * the data — there is no viewer count anywhere in this app because there is no
 * source of one.
 */
export function Sidebar({ channels }: { channels: BrowseChannel[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const open = useSyncExternalStore(
    subscribeRail,
    railIsOpen,
    railIsOpenOnServer,
  );

  const list = expanded ? channels : channels.slice(0, SHOWN);

  return (
    <aside
      className={`sticky top-[57px] hidden h-[calc(100dvh-57px)] shrink-0 border-r border-line bg-ink transition-[width] duration-200 lg:block ${
        open ? 'w-[268px]' : 'w-[68px]'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-4 py-3.5">
          {open && (
            <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-dim">
              Most carried
            </h2>
          )}
          <button
            type="button"
            onClick={() => setRail(!open)}
            aria-label={open ? 'Collapse channel list' : 'Expand channel list'}
            className="ml-auto rounded-md border border-line px-1.5 py-1 font-mono text-[11px] text-faint transition-colors hover:text-text"
          >
            {open ? '«' : '»'}
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {list.map((c) => {
            const active = pathname === `/channel/${encodeURIComponent(c.id)}`;
            return (
              <li key={c.id}>
                <Link
                  href={`/channel/${encodeURIComponent(c.id)}`}
                  title={open ? undefined : c.name}
                  className={`relative flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors ${
                    active ? 'bg-raise' : 'hover:bg-panel'
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                      style={{ background: categoryColor(c.primaryCategory) }}
                    />
                  )}
                  <ChannelLogo
                    src={c.logo}
                    name={c.name}
                    category={c.primaryCategory}
                    size="sm"
                  />
                  {open && (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {c.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                        {c.countryFlag} {c.countryName}
                      </span>
                    </span>
                  )}
                  {open && (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-live shadow-[0_0_8px_var(--live)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}

          {open && channels.length > SHOWN && (
            <li className="px-2 pt-2">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan transition-opacity hover:opacity-80"
              >
                {expanded ? 'Show less' : `Show ${channels.length - SHOWN} more`}
              </button>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
