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
  legislative: 'Civic',
  culture: 'Culture',
  kids: 'Kids',
  documentary: 'Documentary',
  public: 'Public',
  religious: 'Religious',
  weather: 'Weather',
  science: 'Science',
  business: 'Business',
  sports: 'Sport',
  movies: 'Movies',
  series: 'Series',
  music: 'Music',
  entertainment: 'Entertainment',
  comedy: 'Comedy',
  animation: 'Animation',
  lifestyle: 'Lifestyle',
  cooking: 'Cooking',
  travel: 'Travel',
  family: 'Family',
  outdoor: 'Outdoor',
  auto: 'Motors',
  classic: 'Classic',
  relax: 'Relax',
  shop: 'Shopping',
  legislative_alt: 'Civic',
};

/**
 * Each genre gets one of the seven SMPTE bar colours, so the bar on a card
 * tells you what kind of channel it is before you read the name.
 */
export const CATEGORY_COLOR: Record<string, string> = {
  news: 'var(--bar-red)',
  general: 'var(--bar-white)',
  sports: 'var(--bar-green)',
  movies: 'var(--bar-magenta)',
  series: 'var(--bar-magenta)',
  entertainment: 'var(--bar-magenta)',
  comedy: 'var(--bar-magenta)',
  music: 'var(--bar-blue)',
  kids: 'var(--bar-yellow)',
  animation: 'var(--bar-yellow)',
  family: 'var(--bar-yellow)',
  education: 'var(--bar-cyan)',
  documentary: 'var(--bar-cyan)',
  science: 'var(--bar-cyan)',
  culture: 'var(--bar-cyan)',
  legislative: 'var(--bar-blue)',
  public: 'var(--bar-white)',
  business: 'var(--bar-blue)',
  religious: 'var(--bar-magenta)',
  weather: 'var(--bar-cyan)',
  lifestyle: 'var(--bar-yellow)',
  travel: 'var(--bar-green)',
  cooking: 'var(--bar-yellow)',
  outdoor: 'var(--bar-green)',
  auto: 'var(--bar-red)',
  shop: 'var(--bar-yellow)',
  classic: 'var(--bar-white)',
  relax: 'var(--bar-cyan)',
};

export function categoryColor(id: string) {
  return CATEGORY_COLOR[id] ?? 'var(--bar-white)';
}

export function getDataset() {
  return data;
}

export function getChannels(): ApprovedChannel[] {
  return data.channels;
}

export function getChannel(id: string): ApprovedChannel | undefined {
  return data.channels.find((c) => c.id === id);
}

/**
 * The subset of a channel the grid renders. The full catalogue is ~7.6k
 * channels, so the heavy fields must not travel to the browser.
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

export function getCountries() {
  const map = new Map<
    string,
    { code: string; name: string; flag: string; count: number }
  >();
  for (const c of data.channels) {
    const entry = map.get(c.country);
    if (entry) entry.count += 1;
    else
      map.set(c.country, {
        code: c.country,
        name: c.countryName,
        flag: c.countryFlag,
        count: 1,
      });
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

/**
 * How widely a channel is carried across the dataset — the number of distinct
 * feeds mirroring it. It is the only popularity-ish signal that actually
 * exists here: there is no viewer data, so nothing in this UI claims any.
 */
export function reach(c: ApprovedChannel) {
  return c.streams.length;
}

/** The left rail: the most widely carried channels, with logos. */
export function getRailChannels(limit = 160): BrowseChannel[] {
  return [...data.channels]
    .filter((c) => c.logo)
    .sort((a, b) => reach(b) - reach(a) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((c) => ({
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

/**
 * Rows of the home page, in the shape of a streaming front page: a genre and
 * the most widely carried channels in it.
 */
export function getRows(genres: string[], perRow = 14) {
  return genres
    .map((id) => ({
      id,
      label: CATEGORY_LABELS[id] ?? id,
      items: [...data.channels]
        .filter((c) => c.primaryCategory === id && c.logo)
        .sort((a, b) => reach(b) - reach(a) || a.name.localeCompare(b.name))
        .slice(0, perRow)
        .map((c) => ({
          id: c.id,
          name: c.name,
          country: c.country,
          countryName: c.countryName,
          countryFlag: c.countryFlag,
          primaryCategory: c.primaryCategory,
          logo: c.logo,
          owners: c.owners.join(', '),
        })),
    }))
    .filter((row) => row.items.length > 0);
}

/**
 * Recommendations for a channel: same genre first, then same country, ranked
 * by reach. Similarity only — there is no watch history to personalise from.
 */
export function getRecommendations(channel: ApprovedChannel, limit = 10) {
  const scored = data.channels
    .filter((c) => c.id !== channel.id)
    .map((c) => {
      let score = 0;
      if (c.primaryCategory === channel.primaryCategory) score += 3;
      if (c.country === channel.country) score += 2;
      if (c.categories.some((x) => channel.categories.includes(x))) score += 1;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || reach(b.c) - reach(a.c))
    .slice(0, limit);
  return scored.map(({ c }) => c);
}

/** Ids the shuffle button picks from — every channel is fair game. */
export function getShuffleIds(): string[] {
  return data.channels.map((c) => c.id);
}

/**
 * Candidates for the hero. Picked for a recognisable logo and a spread of
 * countries so the front page does not open on the same channel every time.
 */
export function getHeroCandidates(limit = 14) {
  const seen = new Set<string>();
  const pool = data.channels.filter((c) => {
    if (!c.logo || c.streams.length === 0) return false;
    if (seen.has(c.country)) return false;
    seen.add(c.country);
    return true;
  });
  const step = Math.max(1, Math.floor(pool.length / limit));
  return pool
    .filter((_, i) => i % step === 0)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      countryName: c.countryName,
      countryFlag: c.countryFlag,
      primaryCategory: c.primaryCategory,
      logo: c.logo,
      url: c.streams[0].url,
    }));
}

export type HeroCandidate = ReturnType<typeof getHeroCandidates>[number];
