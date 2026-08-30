'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ApprovedChannel } from '@/lib/channels';
import { ChannelLogo } from './ChannelLogo';

type GroupBy = 'country' | 'category';

interface Props {
  channels: ApprovedChannel[];
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
  const [groupBy, setGroupBy] = useState<GroupBy>('country');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((c) => {
      if (country && c.country !== country) return false;
      if (category && c.primaryCategory !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.countryName.toLowerCase().includes(q) ||
        c.owners.some((o) => o.toLowerCase().includes(q))
      );
    });
  }, [channels, query, country, category]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: ApprovedChannel[] }>();
    for (const c of filtered) {
      const key = groupBy === 'country' ? c.country : c.primaryCategory;
      const label =
        groupBy === 'country'
          ? `${c.countryFlag}  ${c.countryName}`
          : (categoryLabels[c.primaryCategory] ?? c.primaryCategory);
      const entry = map.get(key);
      if (entry) entry.items.push(c);
      else map.set(key, { label, items: [c] });
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [filtered, groupBy, categoryLabels]);

  const hasFilters = Boolean(query || country || category);

  return (
    <div>
      <div className="sticky top-[57px] z-10 -mx-5 mb-8 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels, countries, broadcasters…"
            aria-label="Search channels"
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-[14px] outline-none placeholder:text-muted focus:border-accent"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Filter by country"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[12px]">
            {(['country', 'category'] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`rounded-md px-2.5 py-1.5 capitalize transition-colors ${
                  groupBy === g ? 'bg-surface-2 text-foreground' : 'text-muted'
                }`}
              >
                By {g}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCountry('');
                setCategory('');
              }}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {filtered.length} channel{filtered.length === 1 ? '' : 's'} across{' '}
          {groups.length} {groupBy === 'country' ? 'countries' : 'categories'}
        </p>
      </div>

      {groups.length === 0 && (
        <p className="py-20 text-center text-[14px] text-muted">
          No channels match those filters.
        </p>
      )}

      <div className="space-y-10 pb-16">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3.5 flex items-baseline gap-2 text-[14px] font-semibold tracking-tight">
              {group.label}
              <span className="text-[12px] font-normal text-muted">
                {group.items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-2.5">
              {group.items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/channel/${encodeURIComponent(c.id)}`}
                    className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/60 hover:bg-surface-2"
                  >
                    <ChannelLogo src={c.logo} name={c.name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{c.name}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted">
                        {c.countryFlag} {c.countryName} ·{' '}
                        {categoryLabels[c.primaryCategory] ?? c.primaryCategory}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
