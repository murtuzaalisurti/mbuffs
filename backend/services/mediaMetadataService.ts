import { sql } from '../lib/db.js';

// Shared TMDB metadata cache (media_metadata table) for viewing stats.
// Rows are filled lazily: on stats load for anything missing, and in the
// background when a title is marked watched.

export type StatsMediaType = 'movie' | 'tv';

export interface MediaRef {
    mediaType: StatsMediaType;
    tmdbId: number;
}

export interface MetadataPerson {
    id: number;
    name: string;
    profilePath: string | null;
}

export interface MetadataGenre {
    id: number;
    name: string;
}

export interface MediaMetadata {
    mediaType: StatsMediaType;
    tmdbId: number;
    title: string | null;
    posterPath: string | null;
    releaseYear: number | null;
    runtimeMinutes: number | null;
    genres: MetadataGenre[];
    directors: MetadataPerson[];
    topCast: MetadataPerson[];
    originalLanguage: string | null;
    originCountries: string[];
    // TMDB audience signals
    voteCount: number | null;
    voteAverage: number | null;
    popularity: number | null;
    fetchedAt: string;
}

const TOP_CAST_COUNT = 5;
const FETCH_CONCURRENCY = 8;
// Recent titles get runtime/cast filled in after release, so refresh them now and then
const RECENT_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

export const mediaRefKey = (ref: MediaRef): string => `${ref.mediaType}:${ref.tmdbId}`;

// Watched/system collection rows store movies as "123" and TV shows as "123tv"
export const parseStoredMediaId = (mediaId: string): MediaRef | null => {
    const isTv = mediaId.endsWith('tv');
    const numericPart = isTv ? mediaId.slice(0, -2) : mediaId;
    if (!/^\d+$/.test(numericPart)) return null;
    const tmdbId = parseInt(numericPart, 10);
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
    return { mediaType: isTv ? 'tv' : 'movie', tmdbId };
};

type RawMetadataRow = {
    media_type: StatsMediaType;
    tmdb_id: number;
    title: string | null;
    poster_path: string | null;
    release_year: number | null;
    runtime_minutes: number | null;
    genres: MetadataGenre[] | null;
    directors: MetadataPerson[] | null;
    top_cast: MetadataPerson[] | null;
    original_language: string | null;
    origin_countries: string[] | null;
    vote_count: number | null;
    vote_average: string | number | null;
    popularity: string | number | null;
    fetched_at: string;
};

const mapRow = (row: RawMetadataRow): MediaMetadata => ({
    mediaType: row.media_type,
    tmdbId: Number(row.tmdb_id),
    title: row.title,
    posterPath: row.poster_path,
    releaseYear: row.release_year,
    runtimeMinutes: row.runtime_minutes,
    genres: row.genres ?? [],
    directors: row.directors ?? [],
    topCast: row.top_cast ?? [],
    originalLanguage: row.original_language,
    originCountries: row.origin_countries ?? [],
    voteCount: row.vote_count ?? null,
    voteAverage: row.vote_average == null ? null : Number(row.vote_average),
    popularity: row.popularity == null ? null : Number(row.popularity),
    fetchedAt: row.fetched_at,
});

const needsRefresh = (metadata: MediaMetadata): boolean => {
    // Cached before vote counts were stored (TMDB always sends one for titles it has)
    if (metadata.voteCount === null && metadata.title !== null) return true;
    const age = Date.now() - new Date(metadata.fetchedAt).getTime();
    if (age < RECENT_REFRESH_MS) return false;
    const currentYear = new Date().getUTCFullYear();
    // Older titles are settled; only unreleased/recent ones or rows that failed to load change
    return metadata.title === null || metadata.releaseYear === null || metadata.releaseYear >= currentYear - 1;
};

type TmdbPerson = { id: number; name: string; profile_path?: string | null; job?: string; order?: number };

type TmdbDetails = {
    title?: string;
    name?: string;
    poster_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    runtime?: number | null;
    episode_run_time?: number[];
    genres?: MetadataGenre[];
    original_language?: string;
    origin_country?: string[];
    production_countries?: Array<{ iso_3166_1: string }>;
    vote_count?: number;
    vote_average?: number;
    popularity?: number;
    created_by?: TmdbPerson[];
    credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
};

const toPerson = (person: TmdbPerson): MetadataPerson => ({
    id: person.id,
    name: person.name,
    profilePath: person.profile_path ?? null,
});

const parseYear = (date: string | undefined): number | null => {
    if (!date || date.length < 4) return null;
    const year = parseInt(date.slice(0, 4), 10);
    return Number.isNaN(year) ? null : year;
};

const buildMetadata = (ref: MediaRef, data: TmdbDetails): MediaMetadata => {
    const isMovie = ref.mediaType === 'movie';
    const directors = isMovie
        ? (data.credits?.crew ?? []).filter((member) => member.job === 'Director')
        : (data.created_by ?? []);
    const cast = [...(data.credits?.cast ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, TOP_CAST_COUNT);
    const runtime = isMovie ? data.runtime : data.episode_run_time?.[0];
    const countries = data.origin_country?.length
        ? data.origin_country
        : (data.production_countries ?? []).map((country) => country.iso_3166_1);

    return {
        mediaType: ref.mediaType,
        tmdbId: ref.tmdbId,
        title: (isMovie ? data.title : data.name) ?? null,
        posterPath: data.poster_path ?? null,
        releaseYear: parseYear(isMovie ? data.release_date : data.first_air_date),
        runtimeMinutes: runtime && runtime > 0 ? runtime : null,
        genres: (data.genres ?? []).map(({ id, name }) => ({ id, name })),
        directors: directors.map(toPerson),
        topCast: cast.map(toPerson),
        originalLanguage: data.original_language ?? null,
        originCountries: countries,
        voteCount: data.vote_count ?? null,
        voteAverage: data.vote_average ?? null,
        popularity: data.popularity ?? null,
        fetchedAt: new Date().toISOString(),
    };
};

// Placeholder for titles TMDB no longer has, so they are not refetched on every load
const buildMissingMetadata = (ref: MediaRef): MediaMetadata => ({
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    title: null,
    posterPath: null,
    releaseYear: null,
    runtimeMinutes: null,
    genres: [],
    directors: [],
    topCast: [],
    originalLanguage: null,
    originCountries: [],
    voteCount: null,
    voteAverage: null,
    popularity: null,
    fetchedAt: new Date().toISOString(),
});

// Returns null on transient failures (network, rate limit) so the title stays pending
const fetchMetadataFromTmdb = async (ref: MediaRef): Promise<MediaMetadata | null> => {
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = process.env.TMDB_BASE_URL;
    if (!TMDB_API_KEY || !TMDB_BASE_URL) return null;

    try {
        const url = new URL(`${TMDB_BASE_URL}/${ref.mediaType}/${ref.tmdbId}`);
        url.searchParams.set('api_key', TMDB_API_KEY);
        url.searchParams.set('language', 'en-US');
        url.searchParams.set('append_to_response', 'credits');

        const response = await fetch(url.toString());
        if (response.status === 404) return buildMissingMetadata(ref);
        if (!response.ok) {
            console.warn(`[media-metadata] TMDB ${response.status} for ${mediaRefKey(ref)}`);
            return null;
        }
        return buildMetadata(ref, await response.json() as TmdbDetails);
    } catch (error) {
        console.warn(`[media-metadata] fetch failed for ${mediaRefKey(ref)}:`, error);
        return null;
    }
};

const upsertMetadata = async (metadata: MediaMetadata): Promise<void> => {
    await sql`
        INSERT INTO media_metadata (
            media_type, tmdb_id, title, poster_path, release_year, runtime_minutes,
            genres, directors, top_cast, original_language, origin_countries,
            vote_count, vote_average, popularity, fetched_at
        )
        VALUES (
            ${metadata.mediaType}, ${metadata.tmdbId}, ${metadata.title}, ${metadata.posterPath},
            ${metadata.releaseYear}, ${metadata.runtimeMinutes},
            ${JSON.stringify(metadata.genres)}::jsonb, ${JSON.stringify(metadata.directors)}::jsonb,
            ${JSON.stringify(metadata.topCast)}::jsonb, ${metadata.originalLanguage},
            ${JSON.stringify(metadata.originCountries)}::jsonb,
            ${metadata.voteCount}, ${metadata.voteAverage}, ${metadata.popularity}, ${metadata.fetchedAt}
        )
        ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
            title = EXCLUDED.title,
            poster_path = EXCLUDED.poster_path,
            release_year = EXCLUDED.release_year,
            runtime_minutes = EXCLUDED.runtime_minutes,
            genres = EXCLUDED.genres,
            directors = EXCLUDED.directors,
            top_cast = EXCLUDED.top_cast,
            original_language = EXCLUDED.original_language,
            origin_countries = EXCLUDED.origin_countries,
            vote_count = EXCLUDED.vote_count,
            vote_average = EXCLUDED.vote_average,
            popularity = EXCLUDED.popularity,
            fetched_at = EXCLUDED.fetched_at
    `;
};

const fetchAndStore = async (refs: MediaRef[]): Promise<MediaMetadata[]> => {
    const stored: MediaMetadata[] = [];
    for (let i = 0; i < refs.length; i += FETCH_CONCURRENCY) {
        const chunk = refs.slice(i, i + FETCH_CONCURRENCY);
        const results = await Promise.all(chunk.map(fetchMetadataFromTmdb));
        for (const metadata of results) {
            if (!metadata) continue;
            await upsertMetadata(metadata);
            stored.push(metadata);
        }
    }
    return stored;
};

/**
 * Load cached metadata for the given titles, fetching up to `maxFetch` missing
 * (or stale) ones from TMDB. `pending` counts titles still without metadata so
 * the client can poll until the cache is warm.
 */
export const getMediaMetadata = async (
    refs: MediaRef[],
    { maxFetch = 40 }: { maxFetch?: number } = {}
): Promise<{ metadata: Map<string, MediaMetadata>; pending: number }> => {
    const metadata = new Map<string, MediaMetadata>();
    if (refs.length === 0) return { metadata, pending: 0 };

    const mediaTypes = refs.map((ref) => ref.mediaType);
    const tmdbIds = refs.map((ref) => ref.tmdbId);
    const rows = await sql`
        SELECT *
        FROM media_metadata
        WHERE (media_type, tmdb_id) IN (
            SELECT * FROM unnest(${mediaTypes}::text[], ${tmdbIds}::int[])
        )
    ` as RawMetadataRow[];
    for (const row of rows) {
        const mapped = mapRow(row);
        metadata.set(mediaRefKey(mapped), mapped);
    }

    const missing = refs.filter((ref) => !metadata.has(mediaRefKey(ref)));
    const stale = refs.filter((ref) => {
        const cached = metadata.get(mediaRefKey(ref));
        return cached ? needsRefresh(cached) : false;
    });
    // Missing titles first: they block stats, stale ones only sharpen them
    const toFetch = [...missing, ...stale].slice(0, maxFetch);
    for (const fetched of await fetchAndStore(toFetch)) {
        metadata.set(mediaRefKey(fetched), fetched);
    }

    const pending = refs.filter((ref) => !metadata.has(mediaRefKey(ref))).length;
    return { metadata, pending };
};

/** Cache metadata for one title if not stored yet (used when marking watched). */
export const warmMediaMetadata = async (ref: MediaRef): Promise<void> => {
    const existing = await sql`
        SELECT 1 FROM media_metadata
        WHERE media_type = ${ref.mediaType} AND tmdb_id = ${ref.tmdbId}
        LIMIT 1
    `;
    if (existing.length > 0) return;
    await fetchAndStore([ref]);
};
