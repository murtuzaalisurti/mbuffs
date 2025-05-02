import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMovieDetailsApi, fetchTvDetailsApi, getImageUrl } from '@/lib/api';
import { MovieDetails } from '@/lib/types'; // Assuming TvShowDetails type exists
import { Navbar } from "@/components/Navbar";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

const MovieDetail = () => {
    // Assuming routes like /movie/:id or /tv/:id
    // Or a single route /media/:mediaType/:mediaId
    const { mediaType, mediaId } = useParams<{ mediaType: 'movie' | 'tv', mediaId: string }>();

    const isMovie = mediaType === 'movie';
    const queryKey = [mediaType, 'details', mediaId];

    const { data: mediaDetails, isLoading, isError, error } = useQuery<MovieDetails, Error>({
        queryKey: queryKey,
        queryFn: () => {
            if (!mediaId) throw new Error("Media ID is required");
            if (isMovie) {
                return fetchMovieDetailsApi(Number(mediaId)); // Assuming movie ID is always a number
            } else {
                return fetchTvDetailsApi(mediaId as unknown as number); // Assuming TV ID might be string like '1234tv' or just number
            }
        },
        enabled: !!mediaId && !!mediaType,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const renderSkeletons = () => (
        <main className="container py-8">
            <div className="flex flex-col md:flex-row gap-8">
                <Skeleton className="w-full md:w-1/3 aspect-[2/3] rounded-lg" />
                <div className="w-full md:w-2/3 space-y-4">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-6 w-1/4" />
                </div>
            </div>
        </main>
    );

    if (isLoading) {
        return (
            <>
                <Navbar />
                {renderSkeletons()}
            </>
        );
    }

    if (isError) {
        return (
            <>
                <Navbar />
                <main className="container py-8 text-red-500 text-center">
                    Error loading details: {error?.message ?? 'Unknown error'}
                </main>
            </>
        );
    }

    if (!mediaDetails) {
        return (
            <>
                <Navbar />
                <main className="container py-8 text-center">
                    Media not found.
                </main>
            </>
        );
    }

    // Type guards or checking properties to differentiate
    const title = isMovie ? (mediaDetails as MovieDetails).title : (mediaDetails).name;
    const releaseDate = isMovie ? (mediaDetails as MovieDetails).release_date : (mediaDetails).first_air_date;
    const posterPath = mediaDetails.poster_path;
    const backdropPath = mediaDetails.backdrop_path;
    const overview = mediaDetails.overview;
    const genres = mediaDetails.genres ?? [];
    const rating = mediaDetails.vote_average?.toFixed(1);
    const tagline = mediaDetails.tagline;

    return (
        <>
            <Navbar />
            {/* Optional Backdrop */}
            {backdropPath && (
                <div className="relative h-64 md:h-96 w-full">
                    <img
                        src={getImageUrl(backdropPath, 'original')}
                        alt={`${title} backdrop`}
                        className="absolute inset-0 w-full h-full object-cover object-top opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
                </div>
            )}
            <main className={`container pb-12 ${backdropPath ? '-mt-32 md:-mt-48 relative z-10' : 'pt-8'}`}>
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                    {/* Poster */}
                    <div className="w-48 md:w-1/4 lg:w-1/5 flex-shrink-0 mx-auto md:mx-0">
                        <img
                            src={posterPath ? getImageUrl(posterPath, 'w500') : '/placeholder.svg'}
                            alt={title}
                            className="w-full h-auto aspect-[2/3] rounded-lg shadow-lg object-cover bg-muted"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                        />
                    </div>

                    {/* Details */}
                    <div className="flex-grow space-y-3 md:space-y-4 text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>

                        {tagline && <p className="text-lg text-muted-foreground italic">"{tagline}"</p>}

                        <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            {releaseDate && <span>{new Date(releaseDate).getFullYear()}</span>}
                            {releaseDate && rating && <span className="hidden md:inline">•</span>}
                            {rating && rating !== '0.0' && (
                                <span className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {rating}
                                </span>
                            )}
                            {/* Add runtime or number of seasons/episodes if available */}
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                            {genres.map(genre => (
                                <Badge key={genre.id} variant="outline">{genre.name}</Badge>
                            ))}
                        </div>

                        {overview && (
                            <div>
                                <h2 className="text-xl font-semibold mt-4 mb-2">Overview</h2>
                                <p className="text-base leading-relaxed">{overview}</p>
                            </div>
                        )}

                        {/* TODO: Add Cast/Crew, Videos, Recommendations etc. */}

                    </div>
                </div>
            </main>
        </>
    );
};

export default MovieDetail;