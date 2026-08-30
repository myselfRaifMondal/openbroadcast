'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { categoryColor, type BrowseChannel } from '@/lib/channels';
import { ChannelLogo } from './ChannelLogo';

const PAGE_SIZE = 480;

interface Props {
  channels: BrowseChannel[];
  countries: { code: string; name: string; flag: string; count: number }[];
  categories: { id: string; label: string; count: number }[];
  categoryLabels: Record<string, string>;
}

export function ChannelBrowser({
  channels,
  countries,
  categories,
  categoryLabels,
}: Props) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  // "/" opens the global palette instead: this input filters the grid in
  // place, which is a different job from jumping to a channel.

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (country && c.country !== country) return false;
      if (category && c.primaryCategory !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.countryName.toLowerCase().includes(q) ||
        c.owners.toLowerCase().includes(q)
      );
    });
  }, [channels, query, country, category]);

  const [limit, setLimit] = useState(PAGE_SIZE);
  const signature = `${query}|${country}|${category}`;
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setLimit(PAGE_SIZE);
  }

  const visible = filtered.slice(0, limit);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; flag: string; items: BrowseChannel[] }>();
    for (const c of visible) {
      const entry = map.get(c.country);
      if (entry) entry.items.push(c);
      else
        map.set(c.country, {
          label: c.countryName,
          flag: c.countryFlag,
          items: [c],
        });
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [visible]);

  const filtering = Boolean(query || country || category);

  return (
    <div>
      {/* Tuning controls. Search leads because at this scale it is how you
          actually find anything. */}
      <div className="sticky top-[57px] z-20 -mx-5 border-b border-line bg-ink/85 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <span
              aria-hidden
              className="bars pointer-events-none absolute left-3 top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this grid"
              aria-label="Search channels"
              className="w-full rounded-lg border border-line bg-panel py-2.5 pl-7 pr-10 text-[14px] outline-none placeholder:text-faint focus:border-cyan/70"
            />
          </div>

          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Filter by country"
            className="rounded-lg border border-line bg-panel px-3 py-2.5 font-mono text-[12px] text-dim outline-none focus:border-cyan/70"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {c.count}
              </option>
            ))}
          </select>

          {filtering && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCountry('');
                setCategory('');
              }}
              className="rounded-lg border border-line px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-text"
            >
              Reset
            </button>
          )}
        </div>

        {/* Genre chips, colour-coded to the bars. */}
        <div className="mx-auto mt-2.5 flex max-w-[1400px] gap-1.5 overflow-x-auto pb-0.5">
          <Chip
            active={category === ''}
            onClick={() => setCategory('')}
            color="var(--bar-white)"
            label="All"
            count={channels.length}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              color={categoryColor(c.id)}
              label={c.label}
              count={c.count}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px]">
        <p className="py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {filtered.length.toLocaleString()} channels
          {visible.length < filtered.length &&
            ` · showing ${visible.length.toLocaleString()}`}
        </p>

        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span aria-hidden className="testcard h-16 w-28 rounded-md" />
            <p className="text-[14px] text-dim">
              Nothing on that frequency. Try a broader search.
            </p>
          </div>
        )}

        <div className="space-y-9 pb-14">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 flex items-center gap-2.5">
                <span className="text-[15px]" aria-hidden>
                  {group.flag}
                </span>
                <span className="font-display text-[13px] font-bold uppercase tracking-[0.16em]">
                  {group.label}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {group.items.length}
                </span>
                <span aria-hidden className="ml-1 h-px flex-1 bg-line" />
              </h2>

              <ul className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-2">
                {group.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/channel/${encodeURIComponent(c.id)}`}
                      className="group relative flex h-full items-center gap-3 overflow-hidden rounded-lg border border-line bg-panel py-2.5 pl-4 pr-3 transition-colors hover:border-line/0 hover:bg-raise"
                    >
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-full w-[3px] transition-all duration-200 group-hover:w-[5px]"
                        style={{ background: categoryColor(c.primaryCategory) }}
                      />
                      <ChannelLogo
                        src={c.logo}
                        name={c.name}
                        category={c.primaryCategory}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">
                          {c.name}
                        </span>
                        <span className="block truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                          {categoryLabels[c.primaryCategory] ?? c.primaryCategory}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {visible.length < filtered.length && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="rounded-full border border-line bg-panel px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-dim transition-colors hover:border-cyan/60 hover:text-text"
              >
                Load {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? 'border-transparent bg-raise text-text'
          : 'border-line text-dim hover:text-text'
      }`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color, opacity: active ? 1 : 0.55 }}
      />
      {label}
      <span className="font-mono text-[10px] text-faint">{count}</span>
    </button>
  );
}
