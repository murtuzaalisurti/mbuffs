import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchOmdbRatingsBatchApi } from '@/lib/api';
import { Movie } from '@/lib/types';
import { useMemo } from 'react';

export function useOmdbRatings(movies: Movie[]) {
    const items = useMemo(() =>
        movies.map(movie => ({
            tmdbId: String(movie.id),
            mediaType: movie.first_air_date ? 'tv' : 'movie',
        })),
        [movies]
    );

    const sortedKey = useMemo(() =>
        [...items].map(i => `${i.mediaType}:${i.tmdbId}`).sort(),
        [items]
    );

    const { data } = useQuery({
        queryKey: ['omdbRatingsBatch', ...sortedKey],
        queryFn: () => fetchOmdbRatingsBatchApi(items),
        enabled: items.length > 0,
        staleTime: 1000 * 60 * 60,
        placeholderData: keepPreviousData,
    });

    const ratingsMap: Record<string, number> = {};

    if (data?.ratings) {
        for (const [key, value] of Object.entries(data.ratings)) {
            ratingsMap[key] = value.imdbRating;
        }
    }

    return { ratingsMap };
}

export function enrichMoviesWithImdbRatings(
    movies: Movie[],
    ratingsMap: Record<string, number>
): Movie[] {
    if (Object.keys(ratingsMap).length === 0) return movies;

    return movies.map(movie => {
        if (movie.imdb_rating) return movie;
        const mediaType = movie.first_air_date ? 'tv' : 'movie';
        const key = `${mediaType}:${movie.id}`;
        const imdbRating = ratingsMap[key];
        if (imdbRating !== undefined) {
            return { ...movie, imdb_rating: imdbRating };
        }
        return movie;
    });
}
