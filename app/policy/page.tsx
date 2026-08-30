import Link from 'next/link';
import { getDataset } from '@/lib/channels';
import {
  BASIS_EXPLANATIONS,
  BASIS_LABELS,
  DENIED_CATEGORIES,
  PUBLIC_BROADCASTER_OWNERS,
  type LicensingBasis,
} from '@/scripts/policy';

export const metadata = {
  title: 'Filtering policy — OpenBroadcast',
  description:
    'How OpenBroadcast decides which channels are free-to-air, public, or openly licensed enough to list.',
};

export default function PolicyPage() {
  const dataset = getDataset();
  const bases = Object.keys(BASIS_LABELS) as LicensingBasis[];
  const rejections = Object.entries(dataset.rejectionReasons).sort(
    (a, b) => b[1] - a[1],
  );

  const open = dataset.mode === 'open';

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/"
        className="text-[12.5px] text-muted transition-colors hover:text-foreground"
      >
        ← All channels
      </Link>

      {open && (
        <div className="mt-5 rounded-xl border border-accent/40 bg-surface p-4">
          <p className="text-[13.5px] font-medium">
            This build runs in open mode.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            The policy below is what the <code className="font-mono">public</code>{' '}
            build applies. This build does not apply it: it lists every channel
            iptv-org carries a browser-playable stream for, including pay-TV,
            sports, and entertainment services whose streams are not licensed
            for redistribution. Channels that do not match an allow rule are
            labelled <em>No verified licensing basis</em> on their page rather
            than given one. Open mode is for a private, personal catalogue —
            rebuild with <code className="font-mono">npm run filter:channels</code>{' '}
            before publishing.
          </p>
        </div>
      )}

      <h1 className="mt-5 text-[26px] font-semibold tracking-tight">
        Why these channels?
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        The iptv-org dataset lists tens of thousands of streams with no per-channel
        licensing field. OpenBroadcast therefore does not start from that list and
        subtract — it starts from nothing and only admits a channel when a named,
        checkable rule says it is public-service, government, or civic. Anything
        ambiguous is excluded.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {[
          ['Source channels', dataset.counts.sourceChannels.toLocaleString()],
          [open ? 'Listed' : 'Approved', dataset.counts.approved.toLocaleString()],
          ['Excluded', dataset.counts.rejected.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11.5px] uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-[16px] font-semibold tracking-tight">
        The four grounds for inclusion
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        A channel must match at least one. The matched rule is shown on every
        channel page as its licensing basis.
      </p>
      <ol className="mt-4 space-y-3">
        {bases.map((basis, i) => (
          <li key={basis} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[13.5px] font-medium">
              {i + 1}. {BASIS_LABELS[basis]}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {BASIS_EXPLANATIONS[basis]}
            </p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-[16px] font-semibold tracking-tight">
        Hard exclusions
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        These run after every inclusion rule and always win. A channel that
        matches any of them is dropped even if a public broadcaster owns it.
      </p>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-muted">
        <li>
          <strong className="text-foreground">Excluded categories.</strong>{' '}
          {DENIED_CATEGORIES.join(', ')}.
        </li>
        <li>
          <strong className="text-foreground">Premium and pay-TV brands.</strong>{' '}
          Sports rights holders (ESPN, Sky Sports, beIN, DAZN, league networks),
          pay-per-view, and subscription entertainment groups (HBO, Showtime,
          Starz, Paramount, Warner Bros. Discovery, Disney, NBC-owned cable, Fox,
          Star, Zee, and others) — matched against channel name, network, alternate
          names, and owners.
        </li>
        <li>
          <strong className="text-foreground">iptv-org blocklist and NSFW.</strong>{' '}
          Every entry iptv-org flags for a rights complaint or adult content.
        </li>
        <li>
          <strong className="text-foreground">Closed or replaced channels.</strong>
        </li>
        <li>
          <strong className="text-foreground">
            Streams that cannot be played from a browser.
          </strong>{' '}
          Sources requiring a spoofed user-agent or referrer are dropped rather
          than worked around.
        </li>
        <li>
          <strong className="text-foreground">No verifiable basis.</strong> If none
          of the four inclusion rules fires, the channel is excluded. This is the
          single largest exclusion bucket by design.
        </li>
      </ul>

      <h2 className="mt-10 text-[16px] font-semibold tracking-tight">
        What was excluded, and why
      </h2>
      <table className="mt-3 w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 font-normal">Reason</th>
            <th className="py-2 text-right font-normal">Channels</th>
          </tr>
        </thead>
        <tbody>
          {rejections.map(([reason, count]) => (
            <tr key={reason} className="border-b border-border/60">
              <td className="py-1.5">{reason}</td>
              <td className="py-1.5 text-right tabular-nums text-muted">
                {count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-[16px] font-semibold tracking-tight">
        Reviewed public-broadcaster allowlist
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        {PUBLIC_BROADCASTER_OWNERS.length} organisations, matched exactly against
        the owner string in iptv-org&apos;s data. A near-miss is treated as
        unverified, not as a match.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        {PUBLIC_BROADCASTER_OWNERS.join(' · ')}
      </p>

      <h2 className="mt-10 text-[16px] font-semibold tracking-tight">
        How this list is built
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        <code className="font-mono text-[12.5px]">npm run filter:channels</code>{' '}
        fetches the iptv-org indexes, applies the policy above, and writes{' '}
        <code className="font-mono text-[12.5px]">data/channels.approved.json</code>.
        That file is committed and read at build time — the app never calls
        iptv-org at request time. Snapshot generated{' '}
        {new Date(dataset.generatedAt).toISOString().slice(0, 10)}, policy version{' '}
        {dataset.policyVersion}.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Think a channel here does not belong, or one is missing?{' '}
        <a
          href="https://github.com/myselfRaifMondal/openbroadcast/issues"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          Open an issue
        </a>
        .
      </p>
    </div>
  );
}
