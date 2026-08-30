'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

/**
 * The point of a 7,000-channel tuner is surfing, so jumping to a random
 * channel is a primary action, not a novelty. Bound to R as well.
 */
export function ShuffleButton({ ids }: { ids: string[] }) {
  const router = useRouter();

  const surf = useCallback(() => {
    const id = ids[Math.floor(Math.random() * ids.length)];
    router.push(`/channel/${encodeURIComponent(id)}`);
  }, [ids, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        surf();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [surf]);

  return (
    <button
      type="button"
      onClick={surf}
      className="group flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-dim transition-colors hover:border-cyan/60 hover:text-text"
    >
      <span
        aria-hidden
        className="bars h-2.5 w-2.5 rounded-[1px] transition-transform duration-500 group-hover:rotate-180"
      />
      Surf
      <kbd className="hidden rounded border border-line px-1 text-[10px] text-faint sm:inline">
        R
      </kbd>
    </button>
  );
}
