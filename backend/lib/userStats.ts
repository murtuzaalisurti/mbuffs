import type { MediaMetadata, MediaRef, MetadataPerson, StatsMediaType } from '../services/mediaMetadataService.js';
import { mediaRefKey } from '../services/mediaMetadataService.js';

// Pure aggregation for the viewing stats endpoint. Kept free of DB/TMDB access
// so the numbers can be reasoned about (and tested) from plain inputs.

export interface WatchedEntry extends MediaRef {
    watchedAt: string;
}

export interface StatsTimelinePoint {
    // "YYYY-MM" for a single year, "YYYY" for all time
    period: string;
    movies: number;
    shows: number;
}

export interface StatsRankedPerson extends MetadataPerson {
    count: number;
}

export interface StatsTopTitle {
    mediaType: StatsMediaType;
    tmdbId: number;
    title: string | null;
    posterPath: string | null;
    releaseYear: number | null;
    rating: number;
}

export interface StatsPoster {
    mediaType: StatsMediaType;
    tmdbId: number;
    title: string | null;
    posterPath: string;
}

export interface StatsLongestMovie {
    tmdbId: number;
    title: string | null;
    posterPath: string | null;
    runtimeMinutes: number;
}

export interface StatsTitleRef {
    mediaType: StatsMediaType;
    tmdbId: number;
    title: string | null;
    posterPath: string | null;
    releaseYear: number | null;
}

export interface StatsNiche {
    // 0-100: share of titles (with TMDB vote data) that few people have rated
    underTheRadarPercent: number;
    titlesWithVotes: number;
    deepestCut: (StatsTitleRef & { voteCount: number }) | null;
}

export interface StatsTimeMachine {
    // Decade most of the titles were released in (ties go to the more recent decade)
    era: { decade: number; percent: number };
    oldest: StatsTitleRef;
    newestYear: number;
}

export interface UserStatsResponse {
    year: number | null;
    timeZone: string;
    availableYears: number[];
    totals: {
        titles: number;
        movies: number;
        shows: number;
        movieMinutes: number;
        // Movies whose runtime is known (movieMinutes covers only these)
        moviesWithRuntime: number;
        ratedTitles: number;
        averageRating: number | null;
    };
    timeline: StatsTimelinePoint[];
    ratingDistribution: Array<{ rating: number; count: number }>;
    topGenres: Array<{ id: number; name: string; count: number }>;
    topDirectors: StatsRankedPerson[];
    topActors: StatsRankedPerson[];
    decades: Array<{ decade: number; count: number }>;
    languages: Array<{ code: string; count: number }>;
    // Distinct original languages (`languages` lists only the top few)
    languageCount: number;
    topRated: StatsTopTitle[];
    // Most recently watched titles that have a poster, for the page's poster wall
    posterWall: StatsPoster[];
    longestMovie: StatsLongestMovie | null;
    niche: StatsNiche | null;
    timeMachine: StatsTimeMachine | null;
    // Titles whose TMDB metadata is not cached yet; poll until 0
    metadataPending: number;
}

const TOP_GENRES = 8;
const TOP_PEOPLE = 5;
const TOP_LANGUAGES = 6;
const TOP_RATED = 10;
const POSTER_WALL = 24;
// Below these TMDB vote counts a title counts as "under the radar" (TV gets far fewer votes)
const UNDER_THE_RADAR_VOTES: Record<StatsMediaType, number> = { movie: 1000, tv: 300 };

const datePartsInZone = (iso: string, timeZone: string): { year: number; month: number } => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' })
        .formatToParts(new Date(iso));
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    return { year, month };
};

const countBy = <T>(items: T[], keyOf: (item: T) => string | number | null | undefined) => {
    const counts = new Map<string | number, number>();
    for (const item of items) {
        const key = keyOf(item);
        if (key === null || key === undefined) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
};

const rankPeople = (lists: MetadataPerson[][]): StatsRankedPerson[] => {
    const byId = new Map<number, StatsRankedPerson>();
    for (const people of lists) {
        // A person credited twice on one title still counts once for it
        const seen = new Set<number>();
        for (const person of people) {
            if (seen.has(person.id)) continue;
            seen.add(person.id);
            const existing = byId.get(person.id);
            if (existing) existing.count += 1;
            else byId.set(person.id, { ...person, count: 1 });
        }
    }
    return [...byId.values()]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, TOP_PEOPLE);
};

const pad2 = (value: number) => String(value).padStart(2, '0');

export const computeUserStats = ({
    entries,
    metadata,
    ratings,
    year,
    timeZone,
    metadataPending,
}: {
    entries: WatchedEntry[];
    metadata: Map<string, MediaMetadata>;
    // mediaRefKey -> the user's rating for the title (1..10, may be fractional)
    ratings: Map<string, number>;
    year: number | null;
    timeZone: string;
    metadataPending: number;
}): UserStatsResponse => {
    const dated = entries.map((entry) => ({ ...entry, ...datePartsInZone(entry.watchedAt, timeZone) }));
    const availableYears = [...new Set(dated.map((entry) => entry.year))].sort((a, b) => b - a);
    const scoped = year === null ? dated : dated.filter((entry) => entry.year === year);

    const movies = scoped.filter((entry) => entry.mediaType === 'movie');
    const shows = scoped.filter((entry) => entry.mediaType === 'tv');
    const scopedMetadata = scoped
        .map((entry) => metadata.get(mediaRefKey(entry)))
        .filter((item): item is MediaMetadata => item !== undefined);

    const movieRuntimes = movies
        .map((entry) => metadata.get(mediaRefKey(entry))?.runtimeMinutes)
        .filter((runtime): runtime is number => typeof runtime === 'number');

    const rated = scoped
        .map((entry) => ({ entry, rating: ratings.get(mediaRefKey(entry)) }))
        .filter((item): item is { entry: typeof scoped[number]; rating: number } => item.rating !== undefined);
    const averageRating = rated.length > 0
        ? Math.round((rated.reduce((sum, item) => sum + item.rating, 0) / rated.length) * 10) / 10
        : null;

    // Timeline: every month of the chosen year, or every year from first to last watch
    const timeline: StatsTimelinePoint[] = [];
    if (year !== null) {
        for (let month = 1; month <= 12; month++) {
            const inMonth = scoped.filter((entry) => entry.month === month);
            timeline.push({
                period: `${year}-${pad2(month)}`,
                movies: inMonth.filter((entry) => entry.mediaType === 'movie').length,
                shows: inMonth.filter((entry) => entry.mediaType === 'tv').length,
            });
        }
    } else if (availableYears.length > 0) {
        const first = availableYears[availableYears.length - 1];
        const last = availableYears[0];
        for (let y = first; y <= last; y++) {
            const inYear = scoped.filter((entry) => entry.year === y);
            timeline.push({
                period: String(y),
                movies: inYear.filter((entry) => entry.mediaType === 'movie').length,
                shows: inYear.filter((entry) => entry.mediaType === 'tv').length,
            });
        }
    }

    const ratingCounts = countBy(rated, (item) => Math.min(10, Math.max(1, Math.round(item.rating))));
    const ratingDistribution = Array.from({ length: 10 }, (_, index) => ({
        rating: index + 1,
        count: ratingCounts.get(index + 1) ?? 0,
    }));

    const genreNames = new Map<number, string>();
    const genreCounts = new Map<number, number>();
    for (const item of scopedMetadata) {
        for (const genre of item.genres) {
            genreNames.set(genre.id, genre.name);
            genreCounts.set(genre.id, (genreCounts.get(genre.id) ?? 0) + 1);
        }
    }
    const topGenres = [...genreCounts.entries()]
        .map(([id, count]) => ({ id, name: genreNames.get(id) ?? '', count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, TOP_GENRES);

    const decadeCounts = countBy(scopedMetadata, (item) =>
        item.releaseYear === null ? null : Math.floor(item.releaseYear / 10) * 10
    );
    const decades = [...decadeCounts.entries()]
        .map(([decade, count]) => ({ decade: Number(decade), count }))
        .sort((a, b) => a.decade - b.decade);

    const languageCounts = countBy(scopedMetadata, (item) => item.originalLanguage);
    const languages = [...languageCounts.entries()]
        .map(([code, count]) => ({ code: String(code), count }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
        .slice(0, TOP_LANGUAGES);

    const topRated: StatsTopTitle[] = [...rated]
        .sort((a, b) => b.rating - a.rating || b.entry.watchedAt.localeCompare(a.entry.watchedAt))
        .slice(0, TOP_RATED)
        .map(({ entry, rating }) => {
            const item = metadata.get(mediaRefKey(entry));
            return {
                mediaType: entry.mediaType,
                tmdbId: entry.tmdbId,
                title: item?.title ?? null,
                posterPath: item?.posterPath ?? null,
                releaseYear: item?.releaseYear ?? null,
                rating,
            };
        });

    const posterWall: StatsPoster[] = [];
    for (const entry of [...scoped].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))) {
        if (posterWall.length >= POSTER_WALL) break;
        const item = metadata.get(mediaRefKey(entry));
        if (!item?.posterPath) continue;
        posterWall.push({ mediaType: entry.mediaType, tmdbId: entry.tmdbId, title: item.title, posterPath: item.posterPath });
    }

    let longestMovie: StatsLongestMovie | null = null;
    for (const entry of movies) {
        const item = metadata.get(mediaRefKey(entry));
        if (!item?.runtimeMinutes) continue;
        if (!longestMovie || item.runtimeMinutes > longestMovie.runtimeMinutes) {
            longestMovie = { tmdbId: entry.tmdbId, title: item.title, posterPath: item.posterPath, runtimeMinutes: item.runtimeMinutes };
        }
    }

    const toTitleRef = (item: MediaMetadata): StatsTitleRef => ({
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        releaseYear: item.releaseYear,
    });

    const withVotes = scopedMetadata.filter((item): item is MediaMetadata & { voteCount: number } => item.voteCount !== null);
    let niche: StatsNiche | null = null;
    if (withVotes.length > 0) {
        const underTheRadar = withVotes.filter((item) => item.voteCount < UNDER_THE_RADAR_VOTES[item.mediaType]).length;
        const deepest = withVotes
            .filter((item) => item.title !== null)
            .reduce<(MediaMetadata & { voteCount: number }) | null>((best, item) => (!best || item.voteCount < best.voteCount ? item : best), null);
        niche = {
            underTheRadarPercent: Math.round((underTheRadar / withVotes.length) * 100),
            titlesWithVotes: withVotes.length,
            deepestCut: deepest ? { ...toTitleRef(deepest), voteCount: deepest.voteCount } : null,
        };
    }

    const released = scopedMetadata.filter((item): item is MediaMetadata & { releaseYear: number } => item.releaseYear !== null);
    let timeMachine: StatsTimeMachine | null = null;
    if (released.length > 0) {
        const era = decades.reduce((best, d) => (d.count >= best.count ? d : best));
        const oldest = released.reduce((best, item) => (item.releaseYear < best.releaseYear ? item : best));
        timeMachine = {
            era: { decade: era.decade, percent: Math.round((era.count / released.length) * 100) },
            oldest: toTitleRef(oldest),
            newestYear: Math.max(...released.map((item) => item.releaseYear)),
        };
    }

    return {
        year,
        timeZone,
        availableYears,
        totals: {
            titles: scoped.length,
            movies: movies.length,
            shows: shows.length,
            movieMinutes: movieRuntimes.reduce((sum, runtime) => sum + runtime, 0),
            moviesWithRuntime: movieRuntimes.length,
            ratedTitles: rated.length,
            averageRating,
        },
        timeline,
        ratingDistribution,
        topGenres,
        topDirectors: rankPeople(scopedMetadata.map((item) => item.directors)),
        topActors: rankPeople(scopedMetadata.map((item) => item.topCast)),
        decades,
        languages,
        languageCount: languageCounts.size,
        topRated,
        posterWall,
        longestMovie,
        niche,
        timeMachine,
        metadataPending,
    };
};
