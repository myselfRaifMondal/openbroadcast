import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Player } from '@/components/Player';
import { CATEGORY_LABELS, getChannel, getChannels } from '@/lib/channels';

export function generateStaticParams() {
  return getChannels().map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: PageProps<'/channel/[id]'>) {
  const { id } = await props.params;
  const channel = getChannel(decodeURIComponent(id));
  if (!channel) return { title: 'Channel not found — OpenBroadcast' };
  return {
    title: `${channel.name} — live on OpenBroadcast`,
    description: `${channel.name} (${channel.countryName}). ${channel.licensing.label}.`,
  };
}

export default async function ChannelPage(props: PageProps<'/channel/[id]'>) {
  const { id } = await props.params;
  const channel = getChannel(decodeURIComponent(id));
  if (!channel) notFound();

  const related = getChannels()
    .filter((c) => c.country === channel.country && c.id !== channel.id)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link
        href="/"
        className="text-[12.5px] text-muted transition-colors hover:text-foreground"
      >
        ← All channels
      </Link>

      <div className="mt-5 flex items-start gap-4">
        <ChannelLogo src={channel.logo} name={channel.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight">{channel.name}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {channel.countryFlag} {channel.countryName} ·{' '}
            {channel.categories
              .map((c) => CATEGORY_LABELS[c] ?? c)
              .join(' · ')}
          </p>
          {channel.owners.length > 0 && (
            <p className="mt-1 text-[12.5px] text-muted">
              Operated by {channel.owners.join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Player streams={channel.streams} name={channel.name} />
      </div>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-[14px] font-semibold tracking-tight">
          Why is this channel here?
        </h2>
        <p className="mt-1.5 inline-block rounded-md bg-surface-2 px-2 py-1 text-[12px] text-accent">
          {channel.licensing.label}
        </p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          {channel.licensing.explanation}
        </p>
        <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-[12.5px]">
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Evidence</dt>
            <dd className="font-mono text-[12px]">{channel.licensing.evidence}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Channel ID</dt>
            <dd className="font-mono text-[12px]">{channel.id}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Metadata source</dt>
            <dd>
              <a
                href={channel.licensing.source}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                iptv-org channels.json
              </a>
            </dd>
          </div>
          {channel.website && (
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Broadcaster site</dt>
              <dd>
                <a
                  href={channel.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {new URL(channel.website).hostname}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          OpenBroadcast does not host or re-encode this stream. Playback is a
          direct connection to the broadcaster’s own endpoint. Availability may
          still be geo-restricted by the broadcaster.{' '}
          <Link href="/policy" className="underline underline-offset-2">
            Full policy
          </Link>
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[14px] font-semibold tracking-tight">
            More from {channel.countryName}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
            {related.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/channel/${encodeURIComponent(c.id)}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/60 hover:bg-surface-2"
                >
                  <ChannelLogo src={c.logo} name={c.name} />
                  <span className="truncate text-[13px]">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
