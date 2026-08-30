/**
 * Content policy for OpenBroadcast.
 *
 * The iptv-org dataset carries no explicit per-channel licensing field, so this
 * module encodes an explicit allowlist policy instead. A channel is only ever
 * approved when a positive, named basis applies to it; anything ambiguous or
 * unrecognised is dropped. Every allow rule is then re-checked against the
 * denylist, which always wins.
 */

export type LicensingBasis =
  | 'public-service-category'
  | 'legislative-category'
  | 'public-broadcaster-owner'
  | 'government-owner'
  | 'unverified-open-mode';

/**
 * Which catalogue the build produces.
 *
 * - `public` (default): the curated allowlist policy in this file. Safe to
 *   publish — every channel carries a named, checkable licensing basis.
 * - `open`: a personal catalogue. Every channel iptv-org lists with a
 *   browser-playable stream, with no licensing or category filtering at all.
 *   Channels that do not match an allow rule are labelled honestly as
 *   unverified rather than being given a basis they do not have.
 */
export type PolicyMode = 'public' | 'open';

export const BASIS_LABELS: Record<LicensingBasis, string> = {
  'public-service-category':
    'Public broadcaster (iptv-org "public" category)',
  'legislative-category':
    'Government / civic channel (iptv-org "legislative" category)',
  'public-broadcaster-owner':
    'Operated by a national public-service broadcaster',
  'government-owner': 'Operated by a government body or public authority',
  'unverified-open-mode': 'No verified licensing basis (open mode)',
};

export const BASIS_EXPLANATIONS: Record<LicensingBasis, string> = {
  'public-service-category':
    'iptv-org classifies this channel under its "public" category, which is reserved for public-service broadcasters that transmit free-to-air. Public-service broadcasters are funded by licence fee or public budget and carry their signal unencrypted for anyone to receive.',
  'legislative-category':
    'iptv-org classifies this channel under its "legislative" category: parliamentary, municipal, and civic-government feeds. These are published by public bodies as a matter of public record and carried free-to-air or as an open public webcast.',
  'public-broadcaster-owner':
    'The channel is listed by iptv-org as owned by a national public-service broadcaster on OpenBroadcast\'s reviewed allowlist. Those organisations are statutory public broadcasters whose main services are free-to-air.',
  'government-owner':
    'The channel is listed by iptv-org as owned by a government, ministry, state authority, or public university on OpenBroadcast\'s reviewed allowlist. Their output is published by the state for public reception.',
  'unverified-open-mode':
    'This build runs in open mode, which lists every channel iptv-org carries a playable stream for, without applying the licensing policy. Nothing has been checked about this channel\'s rights status: it may be a commercial pay-TV, sports, or entertainment service whose stream is not licensed for redistribution. Open mode is intended for a private, personal catalogue — do not publish this build.',
};

/**
 * Reviewed allowlist of public-service broadcaster owners, exactly as the
 * owner string appears in iptv-org's channels.json. Exact match only — a
 * near-miss is treated as unverified and excluded.
 */
export const PUBLIC_BROADCASTER_OWNERS: string[] = [
  // Europe
  'BBC',
  'ARD',
  'ZDF',
  'Norddeutscher Rundfunk',
  'Bayerischer Rundfunk',
  'Südwestrundfunk',
  'Westdeutscher Rundfunk',
  'Hessischer Rundfunk',
  'Mitteldeutscher Rundfunk',
  'Rundfunk Berlin-Brandenburg',
  'Radio Bremen',
  'Saarländischer Rundfunk',
  'Deutsche Welle',
  'ORF',
  'SRG',
  'SRG SSR',
  'RTVE',
  'RTVE SA',
  'Corporació Catalana de Mitjans Audiovisuals',
  'Televisio de Catalunya',
  'Corporación Aragonesa de Radio y Televisión',
  'Corporació Valenciana de Mitjans de Comunicació',
  'Radio y Televisión de Andalucía',
  'Radiotelevisión del Principado de Asturias',
  'Ente Público Radio Televisión Madrid',
  'Radiotelevisión Española',
  'France Télévisions',
  'Radio France',
  'Arte',
  'RAI',
  'Rai Radiotelevisione Italiana',
  'RTP',
  'Rádio e Televisão de Portugal',
  'VRT',
  'RTBF',
  'NPO',
  'Nederlandse Publieke Omroep',
  'Sveriges Television',
  'NRK',
  'Norsk rikskringkasting',
  'DR',
  'Danmarks Radio',
  'Yle',
  'Yleisradio',
  'RÚV',
  'Ríkisútvarpið',
  'Raidió Teilifís Éireann',
  'RTÉ',
  'S4C',
  'Channel Four Television Corporation',
  'Hellenic Broadcasting Corporation',
  'Cyprus Broadcasting Corporation',
  'Lithuanian National Radio and Television',
  'Latvian Television',
  'Estonian Public Broadcasting',
  'Czech Television',
  'Radio and Television Slovakia',
  'Polskie Radio',
  'Telewizja Polska',
  'Magyar Televízió',
  'Croatian Radiotelevision',
  'Radiotelevision of Slovenia',
  'Radio Television of Serbia',
  'Macedonian Radio Television',
  'Radio Television of Montenegro',
  'Radio and Television of Bosnia and Herzegovina',
  'Radio Televizioni Shqiptar',
  'Romanian Television',
  'Bulgarian National Television',
  'Georgian Public Broadcaster',
  'National Public Television and Radio Company of Ukraine',
  'Public Television Company of Armenia',
  'TRT',
  'Turkish Radio and Television Corporation',
  'Radio Television of Malta',

  // Americas
  'PBS',
  'PBS Member Public Television Stations',
  'American Public Television',
  'Public Broadcasting Service',
  'Maryland Public Broadcasting Commission',
  'Kentucky Authority for Educational TV',
  'Canadian Broadcasting Corporation',
  'Societe Radio-Canada',
  'Société Radio-Canada',
  'Televisión Nacional de Chile',
  'National Institute of Radio and Television of Peru',
  'Empresa Brasil de Comunicação',
  'Sistema Público de Radiodifusión del Estado Mexicano',

  // Asia-Pacific
  'NHK',
  'Japan Broadcasting Corporation',
  'Korean Broadcasting System',
  'Munhwa Broadcasting Corporation',
  'Korea International Broadcasting Foundation',
  'Educational Broadcasting System',
  'Australian Broadcasting Corporation',
  'Special Broadcasting Service',
  'Television New Zealand Ltd.',
  'Radio New Zealand',
  'Prasar Bharati',
  'Pakistan Television Corporation',
  'Sri Lanka Rupavahini Corporation',
  'Nepal Television',
  'Bangladesh Television',
  'Mongolian National Broadcaster',
  'Thai Public Broadcasting Service',
  'Radio Television Brunei',
  'Radio Televisyen Malaysia',
  'Philippine Broadcasting Service',
  'National Broadcasting Corporation of the Kyrgyz Republic',
  'Qazaqstan Radio and Television Corporation',
  'National Television and Radio Company of Uzbekistan',

  // Africa & Middle East
  'SABC',
  'South African Broadcasting Corporation',
  'Tanzania Broadcasting Corporation',
  'Kenya Broadcasting Corporation',
  'Nigerian Television Authority',
  'Ghana Broadcasting Corporation',
  'Namibian Broadcasting Corporation',
  'Zimbabwe Broadcasting Corporation',
  'Bahrain Radio and Television Corporation',
  'Israeli Public Broadcasting Corporation',

  // --- Europe (added in policy 1.1.0) ---
  'Rai',
  'Televiziunea Română',
  'Societatea Română de Televiziune',
  'Radio Televizija Srbije',
  'Hrvatska Radiotelevizija',
  'RTV Slovenia',
  'Radiotelevizija Republike Srpske',
  'Radiotelevizija Federacije BiH',
  'Javno preduzeće Radio televizija Zenica d.o.o. Zenica',
  'Radio Televizija Novi Pazar d.o.o.',
  'Teleradio-Moldova',
  'BNT',
  'S4C Authority',
  'Westdeutscher Rundfunk Köln',
  "Radio i Televisio d'Andorra",
  'Radio Televisión Madrid',
  'The National News Agency of Ukraine',

  // --- Asia-Pacific (added in policy 1.1.0) ---
  'Vietnam Television',
  'Ho Chi Minh City Television Station',
  'RTHK',
  'Taiwan Broadcasting System',
  'Public Service Media',
  'Distance Learning Foundation',
  'National Broadcasting Services of Thailand',
  'National News Bureau of Thailand',
  'Public Relations Department of the Office of the Prime Minister',
  'Educational Broadcasting Cambodia',
  'Korea National Open University',
  'Mediacorp',
  'IRIB',
  'Islamic Republic of Iran Broadcasting',

  // --- Middle East (added in policy 1.1.0) ---
  'Saudi Broadcasting Authority',
  'Saudi Broadcasting Authority (SBA)',
  'Public Television and Radio Broadcasting Company',
  'Azerbaijan Television and Radio Broadcasting Closed Joint-stock Company',
  'Israeli Broadcasting Corporation',
  'Israel Broadcasting Corporation',
  'Palestinian Broadcasting Corporation',
  'RTV Syria',
  'Dubai Media Incorporated',
  'Presidency of Religious Affairs of Republic of Turkiye',
  'Middle East Broadcasting Network',

  // --- China (state broadcasters, free-to-air) ---
  'China Central Television',
  'China Media Group',
  'Shanghai Media Group',
  'Hunan Broadcasting System',

  // --- Africa & Caribbean (added in policy 1.1.0) ---
  'Radiodiffusion télévision ivoirienne',
  'Radiodiffusion télévision sénégalaise',
  'Rwanda Broadcasting Agency',
  'Broadcasting Corporation of The Bahamas',
  'St. Vincent and The Grenadines Broadcasting Corporation Ltd.',
  'Caribbean Broadcasting Corporation',

  // --- Latin America (added in policy 1.1.0) ---
  'Sistema Mexiquense de Medios Publicos',
  'Sistema Mexiquesnse de Medios Publicos', // misspelling as it appears upstream
  'Sistema Jalisciense de Radio y Televisión',
  'Capital Sistema de Comunicación Pública de Bogotá',
  'Comunica EP',
  'Sistema Bolivariano de Comunicación e Información',
  'Sistema Nacional de Televisión',
];

/**
 * Reviewed allowlist patterns for government / public-authority owners.
 * Applied to the whole owner string, case-insensitively.
 */
export const GOVERNMENT_OWNER_PATTERNS: RegExp[] = [
  /^government of .+/i,
  /^.+ government$/i,
  /^ministry of .+/i,
  /^.+ ministry of .+/i,
  // Legislatures. Deliberately narrow: an unqualified /house/ also matches
  // church and media names, so each chamber form is spelled out.
  /^(the )?(united states |u\.s\. )?house of (representatives|commons|lords|assembly)\b/i,
  /^(the )?(united states |u\.s\. )?(senate|congress)\b/i,
  /^(the )?(national |federal |european )?parliament\b/i,
  /^(the )?(national|legislative|general) assembly\b/i,
  /^(city|county|town|borough|municipality|province|state) of .+/i,
  /^department of .+/i,
  /^national state television and radio company of .+/i,
  /^national broadcasting corporation of .+/i,
  /^national television and radio company of .+/i,
  /\bpublic broadcast(ing|er)\b/i,
  /^federal government of .+/i,
  /^state government of .+/i,
  /\bcity council$/i,
  /^omroep .+/i,
  /\bradio ?-? ?television station$/i,
  /\bpublic (television|telecommunications|media)\b/i,
  /^(the )?university of .+/i,
  /\buniversity$/i,
  /\bcommunity college district$/i,
];

/**
 * HARD EXCLUSIONS. These run after every allow rule and always win.
 */
export const DENIED_CATEGORIES = [
  'sports',
  'movies',
  'series',
  'xxx',
  'shop',
  'entertainment',
  'comedy',
  'animation',
  'music',
  'lifestyle',
  'relax',
  'auto',
  'outdoor',
  'travel',
  'cooking',
  'family',
  'classic',
  'interactive',
];

/**
 * Brands and corporate groups that must never appear, matched against channel
 * name, network, and owners. Premium/pay TV, sports rights holders, PPV, and
 * subscription entertainment networks.
 */
export const DENIED_BRAND_PATTERNS: RegExp[] = [
  /\bespn\b/i,
  /\bsky\b/i,
  /\bbein\b/i,
  /\bdazn\b/i,
  /\bfox\b/i,
  /\bhbo\b/i,
  /\bshowtime\b/i,
  /\bstarz\b/i,
  /\bcinemax\b/i,
  /\bnetflix\b/i,
  /\bdisney\b/i,
  /\bhulu\b/i,
  /\bamazon\b/i,
  /\bparamount\b/i,
  /\bviacom\b/i,
  /\bwarner\b/i,
  /\bdiscovery\b/i,
  /\bnbcuniversal\b/i,
  /\bnbc\b/i,
  /\bcnbc\b/i,
  /\bmsnbc\b/i,
  /\btelemundo\b/i,
  /\bcomcast\b/i,
  /\bamc networks\b/i,
  /\bturner\b/i,
  /\btnt\b/i,
  /\bcnn\b/i,
  /\bstar\b/i,
  /\bzee\b/i,
  /\bsony\b/i,
  /\bhallmark\b/i,
  /\bbet\b/i,
  /\bmtv\b/i,
  /\bnickelodeon\b/i,
  /\bpluto\b/i,
  /\bnexstar\b/i,
  /\bsinclair\b/i,
  /\bgray television\b/i,
  /\bscripps\b/i,
  /\bviaplay\b/i,
  /\bcanal\+/i,
  /\bosn\b/i,
  /\bppv\b/i,
  /pay[- ]?per[- ]?view/i,
  /\bpremium\b/i,
  /\bpay[- ]?tv\b/i,
  /\bppv\b/i,
  /\bmlb\b/i,
  /\bnba\b/i,
  /\bnfl\b/i,
  /\bnhl\b/i,
  /\buefa\b/i,
  /\bfifa\b/i,
  /\bformula ?1\b/i,
  /\bwwe\b/i,
  /\bufc\b/i,
  /\bsupersport\b/i,
  /\beurosport\b/i,
  /\bmajor league\b/i,
];

/**
 * Channels that are plainly sport but carry no `sports` tag upstream.
 *
 * An explicit id list, reviewed one by one — a name regex on "motor" or
 * "formula" pulls in motoring shows and a Georgian news channel called
 * Formula, none of which are sport. Anything ambiguous stays out and keeps the
 * genre iptv-org gave it.
 */
export const EXTRA_SPORT_CHANNELS: string[] = [
  'PolsatSport1.pl',
  'TNAWrestlingChannel.pl',
  'WomensSportsNetwork.us',
];

export function matchesDeniedBrand(...fields: (string | null | undefined)[]) {
  for (const field of fields) {
    if (!field) continue;
    for (const pattern of DENIED_BRAND_PATTERNS) {
      if (pattern.test(field)) return pattern.source;
    }
  }
  return null;
}
