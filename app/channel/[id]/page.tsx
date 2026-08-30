import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Player } from '@/components/Player';
import {
  CATEGORY_LABELS,
  categoryColor,
  getChannel,
  getChannels,
  getRecommendations,
} from '@/lib/channels';

export function generateStaticParams() {
  return getChannels().map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: PageProps<'/channel/[id]'>) {
  const { id } = await props.params;
  const channel = getChannel(decodeURIComponent(id));
  if (!channel) return { title: 'Off air — OpenBroadcast' };
  return {
    title: `${channel.name} · OpenBroadcast`,
    description: `${channel.name}, live from ${channel.countryName}.`,
  };
}

export default async function ChannelPage(props: PageProps<'/channel/[id]'>) {
  const { id } = await props.params;
  const channel = getChannel(decodeURIComponent(id));
  if (!channel) notFound();

  const accent = categoryColor(channel.primaryCategory);
  const categories =
    channel.categories.length > 0 ? channel.categories : [channel.primaryCategory];

  const recommended = getRecommendations(channel, 12);

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0">
          <div className="tune-in">
            <Player streams={channel.streams} name={channel.name} />
          </div>

          {/* Ident bar, in the register of an on-screen station bug. */}
          <div
            className="mt-4 flex items-start gap-4 border-l-2 pl-4"
            style={{ borderColor: accent }}
          >
            <ChannelLogo
              src={channel.logo}
              name={channel.name}
              category={channel.primaryCategory}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              {/* No status pill here: the player is the only thing that knows
                  whether the feed is actually up, and a LIVE badge sitting
                  beside a "No signal" screen would simply be wrong. */}
              <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-[-0.015em] sm:text-[30px]">
                {channel.name}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                <span>
                  {channel.countryFlag} {channel.countryName}
                </span>
                <span aria-hidden className="text-faint">/</span>
                <span style={{ color: accent }}>
                  {categories.map((c) => CATEGORY_LABELS[c] ?? c).join(' · ')}
                </span>
                {channel.streams.length > 1 && (
                  <>
                    <span aria-hidden className="text-faint">/</span>
                    <span>{channel.streams.length} feeds</span>
                  </>
                )}
              </p>
              {channel.owners.length > 0 && (
                <p className="mt-1.5 text-[12.5px] text-faint">
                  {channel.owners.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Up next. Similarity only — genre, then country, then how widely the
            channel is carried. Nothing here is personalised, because there is
            no watch history to personalise from. */}
        <aside className="min-w-0">
          <h2 className="mb-2.5 font-display text-[12px] font-bold uppercase tracking-[0.18em] text-dim">
            Up next
          </h2>
          <ul className="space-y-1.5">
            {recommended.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/channel/${encodeURIComponent(c.id)}`}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-line bg-panel py-2 pl-4 pr-3 transition-colors hover:bg-raise"
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {c.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                      {c.countryFlag} {c.countryName} ·{' '}
                      {CATEGORY_LABELS[c.primaryCategory] ?? c.primaryCategory}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-live shadow-[0_0_8px_var(--live)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
