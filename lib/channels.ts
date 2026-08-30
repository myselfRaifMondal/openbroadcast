import dataset from '@/data/channels.approved.json';
import type {
  ApprovedChannel,
  ApprovedDataset,
  ApprovedStream,
} from '@/scripts/filter-channels';

const data = dataset as unknown as ApprovedDataset;

export type { ApprovedChannel, ApprovedStream };

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  news: 'News',
  education: 'Education',
  legislative: 'Government & Civic',
  culture: 'Culture',
  kids: 'Kids',
  documentary: 'Documentary',
  public: 'Public Service',
  religious: 'Religious',
  weather: 'Weather',
  science: 'Science',
  business: 'Business',
};

export function getDataset() {
  return data;
}

export function getChannels(): ApprovedChannel[] {
  return data.channels;
}

/**
 * The subset of a channel the grid actually renders. Open mode ships ~9k
 * channels to the browser, so the full records (streams, licensing prose)
 * must not travel with them.
 */
export interface BrowseChannel {
  id: string;
  name: string;
  country: string;
  countryName: string;
  countryFlag: string;
  primaryCategory: string;
  logo: string | null;
  /** Joined owner names, kept only so search can match on broadcaster. */
  owners: string;
}

export function getBrowseIndex(): BrowseChannel[] {
  return data.channels.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    countryName: c.countryName,
    countryFlag: c.countryFlag,
    primaryCategory: c.primaryCategory,
    logo: c.logo,
    owners: c.owners.join(', '),
  }));
}

export function getChannel(id: string): ApprovedChannel | undefined {
  return data.channels.find((c) => c.id === id);
}

export function getCountries() {
  const map = new Map<string, { code: string; name: string; flag: string; count: number }>();
  for (const c of data.channels) {
    const entry = map.get(c.country);
    if (entry) entry.count += 1;
    else map.set(c.country, { code: c.country, name: c.countryName, flag: c.countryFlag, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategories() {
  const map = new Map<string, number>();
  for (const c of data.channels) {
    map.set(c.primaryCategory, (map.get(c.primaryCategory) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([id, count]) => ({ id, label: CATEGORY_LABELS[id] ?? id, count }))
    .sort((a, b) => b.count - a.count);
}
