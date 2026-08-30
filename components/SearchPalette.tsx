'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORY_LABELS, categoryColor } from '@/lib/channels';

/** [id, name, flag, country, category] — see scripts/build-search-index.ts. */
type Row = [string, string, string, string, string];

const MAX_RESULTS = 40;

// Fetched once per page load, then kept for the life of the tab.
let cache: Row[] | null = null;
let inFlight: Promise<Row[]> | null = null;

function loadIndex(): Promise<Row[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = fetch('/search-index.json')
      .then((r) => r.json() as Promise<Row[]>)
      .then((rows) => {
        cache = rows;
        return rows;
      })
      .catch(() => {
        inFlight = null;
        return [];
      });
  }
  return inFlight;
}

/**
 * Search from anywhere, including mid-programme. The catalogue is far too big
 * to only be searchable from the front page.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const show = useCallback(() => {
    setOpen(true);
    void loadIndex().then(setRows);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        show();
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        show();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? rows
        .filter(
          (r) =>
            r[1].toLowerCase().includes(q) || r[3].toLowerCase().includes(q),
        )
        .slice(0, MAX_RESULTS)
    : rows.slice(0, MAX_RESULTS);

  function close() {
    setOpen(false);
    setQuery('');
    setActive(0);
  }

  function go(row: Row) {
    close();
    router.push(`/channel/${encodeURIComponent(row[0])}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  // Keep the highlighted row in view as the arrows move down the list.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:border-cyan/60 hover:text-text"
      >
        <span aria-hidden className="bars h-2.5 w-1 rounded-full" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-line px-1 text-[10px] text-faint sm:inline">
          /
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 p-4 backdrop-blur-sm sm:p-10"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search channels"
            className="tune-in mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span aria-hidden className="bars h-4 w-1 shrink-0 rounded-full" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={
                  rows.length
                    ? `Search ${rows.length.toLocaleString()} channels`
                    : 'Loading channels…'
                }
                aria-label="Search channels"
                className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-faint"
              />
              <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">
                Esc
              </kbd>
            </div>

            <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                  {rows.length ? 'Nothing on that frequency' : 'Tuning…'}
                </li>
              )}
              {results.map((r, i) => (
                <li key={r[0]}>
                  <button
                    type="button"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      i === active ? 'bg-raise' : ''
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-6 w-[3px] shrink-0 rounded-full"
                      style={{ background: categoryColor(r[4]) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {r[1]}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                        {r[2]} {r[3]} · {CATEGORY_LABELS[r[4]] ?? r[4]}
                      </span>
                    </span>
                    {i === active && (
                      <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
                        ↵
                      </kbd>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
