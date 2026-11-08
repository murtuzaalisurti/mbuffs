import type { WatchProvider, WatchProvidersResult } from './types';

// Streaming filter: groups TMDB (JustWatch) provider ids into the brands users
// recognise, and matches titles against a selection of brands and offer types.
//
// TMDB lists one brand under several ids (ad tiers, kids profiles, Amazon/Apple
// channel add-ons, and separate rent/buy storefronts such as "Amazon Video" for
// Prime). Ids were taken from /watch/providers/{movie,tv} for IN, US and GB.

export type OfferType = 'stream' | 'rent' | 'buy';

export const OFFER_TYPES: OfferType[] = ['stream', 'rent', 'buy'];

export const OFFER_LABELS: Record<OfferType, string> = {
    stream: 'Stream',
    rent: 'Rent',
    buy: 'Buy',
};

export interface StreamingBrand {
    id: string;
    name: string;
    /** Subscription, free and ad-supported tiers, including channel add-ons. */
    streamIds: number[];
    /** Storefronts that rent or sell titles. */
    storeIds: number[];
}

export const STREAMING_BRANDS: StreamingBrand[] = [
    { id: 'netflix', name: 'Netflix', streamIds: [8, 1796, 175], storeIds: [] },
    { id: 'prime', name: 'Prime Video', streamIds: [9, 119, 2100, 613], storeIds: [10] },
    { id: 'disney', name: 'JioHotstar / Disney+', streamIds: [2336, 337, 122], storeIds: [] },
    { id: 'apple', name: 'Apple TV', streamIds: [350, 2243], storeIds: [2] },
    { id: 'sonyliv', name: 'Sony LIV', streamIds: [237, 2792], storeIds: [] },
    { id: 'zee5', name: 'Zee5', streamIds: [232], storeIds: [] },
    { id: 'mubi', name: 'MUBI', streamIds: [11, 201], storeIds: [] },
    { id: 'hbomax', name: 'HBO Max', streamIds: [1899, 384, 1825], storeIds: [] },
    { id: 'hulu', name: 'Hulu', streamIds: [15], storeIds: [] },
    { id: 'peacock', name: 'Peacock', streamIds: [386, 387], storeIds: [] },
    { id: 'paramount', name: 'Paramount+', streamIds: [531, 2303, 2616, 582], storeIds: [] },
    { id: 'crunchyroll', name: 'Crunchyroll', streamIds: [283, 1968], storeIds: [] },
    { id: 'youtube', name: 'YouTube', streamIds: [188], storeIds: [192] },
    { id: 'googleplay', name: 'Google Play', streamIds: [], storeIds: [3] },
];

const BRAND_BY_ID = new Map(STREAMING_BRANDS.map((brand) => [brand.id, brand]));

const BRAND_ID_BY_PROVIDER = new Map<number, string>(
    STREAMING_BRANDS.flatMap((brand) =>
        [...brand.streamIds, ...brand.storeIds].map((providerId) => [providerId, brand.id] as const),
    ),
);

// TMDB groups a title's offers by monetization type; free and ad-supported
// viewing count as streaming.
const RESULT_KEYS_BY_OFFER: Record<OfferType, (keyof WatchProvidersResult)[]> = {
    stream: ['flatrate', 'free', 'ads'],
    rent: ['rent'],
    buy: ['buy'],
};

/** Selected brand ids mapped to the offer types to match, or null for any offer. */
export type StreamingSelection = Record<string, OfferType[] | null>;

export interface BrandAvailability {
    brand: StreamingBrand;
    offers: OfferType[];
    logoPath: string | null;
    displayPriority: number;
}

/**
 * Brands present in a region's provider list, in TMDB display order. A brand
 * offers rent/buy only where one of its storefronts operates in that region.
 */
export const getAvailableBrands = (regionProviders: WatchProvider[]): BrandAvailability[] => {
    const providerById = new Map(regionProviders.map((provider) => [provider.provider_id, provider]));

    return STREAMING_BRANDS.flatMap((brand) => {
        const streamProviders = brand.streamIds.flatMap((id) => providerById.get(id) ?? []);
        const storeProviders = brand.storeIds.flatMap((id) => providerById.get(id) ?? []);
        const providers = [...streamProviders, ...storeProviders];
        if (providers.length === 0) return [];

        const offers: OfferType[] = [];
        if (streamProviders.length > 0) offers.push('stream');
        if (storeProviders.length > 0) offers.push('rent', 'buy');

        return [{
            brand,
            offers,
            logoPath: providers[0].logo_path ?? null,
            displayPriority: Math.min(...providers.map((provider) => provider.display_priority)),
        }];
    }).sort((a, b) => a.displayPriority - b.displayPriority);
};

/** Each brand a title is on, with the offer types available for it. */
export const getTitleBrandOffers = (result: WatchProvidersResult | undefined): Map<string, Set<OfferType>> => {
    const brandOffers = new Map<string, Set<OfferType>>();
    if (!result) return brandOffers;

    for (const offer of OFFER_TYPES) {
        for (const key of RESULT_KEYS_BY_OFFER[offer]) {
            const providers = result[key];
            if (!Array.isArray(providers)) continue;
            for (const provider of providers) {
                const brandId = BRAND_ID_BY_PROVIDER.get(provider.provider_id);
                if (!brandId) continue;
                const offers = brandOffers.get(brandId) ?? new Set<OfferType>();
                offers.add(offer);
                brandOffers.set(brandId, offers);
            }
        }
    }

    return brandOffers;
};

/** True when the title is on any selected brand with one of its selected offer types. */
export const matchesStreamingSelection = (
    result: WatchProvidersResult | undefined,
    selection: StreamingSelection,
): boolean => {
    const selected = Object.entries(selection);
    if (selected.length === 0) return true;

    const brandOffers = getTitleBrandOffers(result);
    return selected.some(([brandId, offers]) => {
        const available = brandOffers.get(brandId);
        if (!available) return false;
        return offers === null || offers.some((offer) => available.has(offer));
    });
};

/** Number of titles on each brand, for showing counts next to filter options. */
export const countTitlesByBrand = (results: (WatchProvidersResult | undefined)[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const result of results) {
        for (const brandId of getTitleBrandOffers(result).keys()) {
            counts[brandId] = (counts[brandId] ?? 0) + 1;
        }
    }
    return counts;
};

/** Drops brands and offer types the region doesn't have. */
export const restrictSelectionToAvailable = (
    selection: StreamingSelection,
    available: BrandAvailability[],
): StreamingSelection => {
    const offersByBrand = new Map(available.map(({ brand, offers }) => [brand.id, offers]));
    const restricted: StreamingSelection = {};

    for (const [brandId, offers] of Object.entries(selection)) {
        const supported = offersByBrand.get(brandId);
        if (!supported) continue;
        if (offers === null) {
            restricted[brandId] = null;
            continue;
        }
        const kept = offers.filter((offer) => supported.includes(offer));
        // Kept even when it lists every supported offer, so the UI shows what was
        // picked; matching treats that the same as "any".
        restricted[brandId] = kept.length > 0 ? kept : null;
    }

    return restricted;
};

/**
 * Discover params for a selection. Discover applies with_watch_monetization_types
 * independently of with_watch_providers, so streaming vs. rent/buy is expressed
 * through provider ids (subscriptions vs. storefronts). The monetization types
 * only narrow rent vs. buy, and are left out when every offer type is selected.
 */
export const buildDiscoverProviderParams = (
    selection: StreamingSelection,
    region: string,
): Record<string, string> | null => {
    const providerIds = new Set<number>();
    const offerTypes = new Set<OfferType>();

    for (const [brandId, selectedOffers] of Object.entries(selection)) {
        const brand = BRAND_BY_ID.get(brandId);
        if (!brand) continue;
        const offers = selectedOffers ?? OFFER_TYPES;
        if (offers.includes('stream')) brand.streamIds.forEach((id) => providerIds.add(id));
        if (offers.includes('rent') || offers.includes('buy')) brand.storeIds.forEach((id) => providerIds.add(id));
        for (const offer of offers) {
            if (offer === 'stream' && brand.streamIds.length === 0) continue;
            if (offer !== 'stream' && brand.storeIds.length === 0) continue;
            offerTypes.add(offer);
        }
    }

    if (providerIds.size === 0) return null;

    const params: Record<string, string> = {
        watch_region: region,
        with_watch_providers: [...providerIds].sort((a, b) => a - b).join('|'),
    };

    if (offerTypes.size > 0 && offerTypes.size < OFFER_TYPES.length) {
        params.with_watch_monetization_types = OFFER_TYPES
            .filter((offer) => offerTypes.has(offer))
            .flatMap((offer) => (offer === 'stream' ? ['flatrate', 'free', 'ads'] : [offer]))
            .join('|');
    }

    return params;
};

/**
 * Whether discover results for a selection need a per-title provider check.
 * Subscription and storefront ids already separate streaming from rent/buy, so
 * discover is exact unless a storefront brand is limited to rent or to buy:
 * discover would accept a title sold on that store and rented on another.
 */
export const needsPerTitleProviderCheck = (selection: StreamingSelection): boolean =>
    Object.entries(selection).some(([brandId, offers]) => {
        const brand = BRAND_BY_ID.get(brandId);
        if (!brand || brand.storeIds.length === 0 || offers === null) return false;
        return offers.includes('rent') !== offers.includes('buy');
    });

export interface DiscoverPage<T> {
    page: number;
    results: T[];
    total_pages: number;
    total_results: number;
}

interface ExactDiscoverPageOptions<T> {
    startPage: number;
    selection: StreamingSelection;
    fetchPage: (page: number) => Promise<DiscoverPage<T>>;
    fetchProviders: (ids: number[]) => Promise<Record<number, WatchProvidersResult | null>>;
    /** Keep fetching discover pages until at least this many titles match... */
    minResults?: number;
    /** ...or this many pages were fetched, so one scroll step stays bounded. */
    maxPages?: number;
}

/**
 * Fetches discover pages from `startPage` and keeps only titles whose providers
 * match the selection exactly. Sparse pages pull in following ones; the returned
 * `page` is the last one fetched, so infinite scroll resumes after it. A failed
 * provider lookup keeps the title, since discover already matched it loosely
 * and never drops true matches.
 */
export const fetchExactDiscoverPage = async <T extends { id: number }>({
    startPage,
    selection,
    fetchPage,
    fetchProviders,
    minResults = 10,
    maxPages = 3,
}: ExactDiscoverPageOptions<T>): Promise<DiscoverPage<T>> => {
    const results: T[] = [];
    let last: DiscoverPage<T> | null = null;

    for (let page = startPage; page < startPage + maxPages; page++) {
        const data = await fetchPage(page);
        if (!data.page) return last ? { ...last, results } : data;
        last = data;

        const providers: Record<number, WatchProvidersResult | null> = await fetchProviders(
            data.results.map((item) => item.id),
        ).catch(() => ({}));
        results.push(...data.results.filter((item) => {
            const result = providers[item.id];
            return result === null || result === undefined || matchesStreamingSelection(result, selection);
        }));

        if (results.length >= minResults || data.page >= data.total_pages) break;
    }

    return { ...last!, results };
};

// URL format: `netflix,prime.rent.buy` (no offer suffix means any offer).
export const parseStreamingSelection = (value: string | null): StreamingSelection => {
    const selection: StreamingSelection = {};
    if (!value) return selection;

    for (const part of value.split(',')) {
        const [brandId, ...offerParts] = part.split('.');
        if (!BRAND_BY_ID.has(brandId)) continue;
        const offers = offerParts.filter((offer): offer is OfferType => OFFER_TYPES.includes(offer as OfferType));
        selection[brandId] = offers.length > 0 ? [...new Set(offers)] : null;
    }

    return selection;
};

export const serializeStreamingSelection = (selection: StreamingSelection): string =>
    STREAMING_BRANDS
        .filter((brand) => brand.id in selection)
        .map((brand) => {
            const offers = selection[brand.id];
            return offers ? [brand.id, ...OFFER_TYPES.filter((offer) => offers.includes(offer))].join('.') : brand.id;
        })
        .join(',');

export const getBrandName = (brandId: string): string => BRAND_BY_ID.get(brandId)?.name ?? brandId;

// Category grids only filter the default discover results: personalized
// recommendations carry no provider data, and theatrical releases aren't streaming.
export const getCategoryStreamingDisabledReason = (showPersonalized: boolean, isTheatrical: boolean): string | null =>
    showPersonalized
        ? "Streaming filters aren't available for personalized recommendations. Turn off category recommendations in your profile to filter by service."
        : isTheatrical
            ? "Theatrical releases are in cinemas, so there's nothing to filter by streaming service."
            : null;
