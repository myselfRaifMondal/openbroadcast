import { ChannelBrowser } from '@/components/ChannelBrowser';
import { ChannelRow } from '@/components/ChannelRow';
import { HeroTuner } from '@/components/HeroTuner';
import {
  CATEGORY_LABELS,
  categoryColor,
  getBrowseIndex,
  getCategories,
  getCountries,
  getDataset,
  getHeroCandidates,
  getRows,
} from '@/lib/channels';

export default function HomePage() {
  const dataset = getDataset();
  const channels = getBrowseIndex();
  const countries = getCountries();
  const rows = getRows(['news', 'sports', 'documentary', 'kids', 'music', 'general']);

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-2">
      <div className="py-5">
        <HeroTuner
          candidates={getHeroCandidates()}
          channelCount={dataset.counts.approved}
          countryCount={countries.length}
        />
      </div>

      <div className="space-y-8 py-2">
        {rows.map((row) => (
          <ChannelRow
            key={row.id}
            label={row.label}
            items={row.items}
            accent={categoryColor(row.id)}
          />
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-1 font-display text-[13px] font-bold uppercase tracking-[0.16em]">
          Browse everything
        </h2>
      </div>

      <ChannelBrowser
        channels={channels}
        countries={countries}
        categories={getCategories()}
        categoryLabels={CATEGORY_LABELS}
      />
    </div>
  );
}
