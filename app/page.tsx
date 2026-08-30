import Link from 'next/link';
import { ChannelBrowser } from '@/components/ChannelBrowser';
import {
  CATEGORY_LABELS,
  getCategories,
  getChannels,
  getCountries,
  getDataset,
} from '@/lib/channels';

export default function HomePage() {
  const dataset = getDataset();
  const channels = getChannels();

  return (
    <div className="mx-auto max-w-7xl px-5">
      <section className="py-10">
        <h1 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          Live TV that is public by design.
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted">
          {dataset.counts.approved} channels from public-service broadcasters,
          governments, and civic bodies across {getCountries().length}{' '}
          countries — filtered down from {dataset.counts.sourceChannels.toLocaleString()}{' '}
          entries in the iptv-org dataset. No pay TV, no sports rights, no
          channel without a stated licensing basis.{' '}
          <Link href="/policy" className="text-foreground underline underline-offset-2">
            Read the policy
          </Link>
          .
        </p>
      </section>

      <ChannelBrowser
        channels={channels}
        countries={getCountries()}
        categories={getCategories()}
        categoryLabels={CATEGORY_LABELS}
      />
    </div>
  );
}
