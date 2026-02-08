import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMovieDetailsApi, fetchTvDetailsApi, fetchVideosApi, fetchCreditsApi, getImageUrl } from '@/lib/api';
import { MovieDetails, Network, Video, CastMember, CrewMember } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageOff, Star, Play, User } from 'lucide-react';
import { useState } from 'react';

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

function NetworkBadge({ network }: { network: Network }) {
    return (
        <div className="flex items-center justify-center rounded-md bg-white/[0.06] border border-white/[0.08] px-2 py-1 transition-colors hover:bg-white/[0.1]" title={network.name}>
            {network.logo_path ? (
                <img
                    src={`${TMDB_LOGO_BASE}${network.logo_path}`}
                    alt={network.name}
                    className="h-3 w-auto object-contain brightness-0 invert opacity-90"
                />
            ) : (
                <span className="text-xs font-medium text-foreground/70">{network.name}</span>
            )}
        </div>
    );
}

const OVERVIEW_CHAR_LIMIT = 150;

const MovieDetail = () => {
    const { mediaType, mediaId } = useParams<{ mediaType: 'movie' | 'tv', mediaId: string }>();

    const isMovie = mediaType === 'movie';
    const queryKey = [mediaType, 'details', mediaId];

    const { data: mediaDetails, isLoading, isError, error } = useQuery<MovieDetails, Error>({
        queryKey: queryKey,
        queryFn: () => {
            if (!mediaId) throw new Error("Media ID is required");
            if (isMovie) {
                return fetchMovieDetailsApi(Number(mediaId));
            } else {
                return fetchTvDetailsApi(mediaId as unknown as number);
            }
        },
        enabled: !!mediaId && !!mediaType,
        staleTime: 1000 * 60 * 60,
    });

    // Fetch videos/trailers
    const { data: videosData } = useQuery({
        queryKey: [mediaType, 'videos', mediaId],
        queryFn: () => fetchVideosApi(mediaType as 'movie' | 'tv', Number(mediaId)),
        enabled: !!mediaId && !!mediaType,
        staleTime: 1000 * 60 * 60,
    });

    // Fetch credits/cast
    const { data: creditsData } = useQuery({
        queryKey: [mediaType, 'credits', mediaId],
        queryFn: () => fetchCreditsApi(mediaType as 'movie' | 'tv', Number(mediaId)),
        enabled: !!mediaId && !!mediaType,
        staleTime: 1000 * 60 * 60,
    });

    // Find the best trailer: prefer official YouTube trailers
    const trailer = videosData?.results?.find(
        (v: Video) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
    ) || videosData?.results?.find(
        (v: Video) => v.site === 'YouTube' && v.type === 'Trailer'
    ) || videosData?.results?.find(
        (v: Video) => v.site === 'YouTube' && v.type === 'Teaser'
    );

    // Get top cast members (limit to 12)
    const cast = creditsData?.cast?.slice(0, 12) ?? [];

    // Get director(s) from crew
    const directors = creditsData?.crew?.filter((c: CrewMember) => c.job === 'Director') ?? [];

    const [showTrailer, setShowTrailer] = useState(false);
    const [overviewExpanded, setOverviewExpanded] = useState(false);

    const renderSkeletons = () => (
        <>
            {/* Skeleton backdrop — matches real backdrop area */}
            <div className="-mt-16 relative w-full h-[50vh] md:h-[60vh] overflow-hidden">
                <Skeleton className="absolute inset-0 rounded-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
            </div>

            <main className="container relative z-10 -mt-40 md:-mt-48 pb-12">
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                    {/* Poster skeleton */}
                    <div className="w-48 md:w-56 lg:w-64 flex-shrink-0 mx-auto md:mx-0">
                        <Skeleton className="w-full aspect-[2/3] rounded-xl" />
                    </div>

                    {/* Details skeleton */}
                    <div className="flex-grow space-y-4 pt-2 md:pt-8">
                        <Skeleton className="h-10 w-64 md:w-80 rounded-lg" />
                        <Skeleton className="h-5 w-48 rounded-md" />
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <div className="flex gap-2">
                            <Skeleton className="h-7 w-10 rounded-md" />
                            <Skeleton className="h-7 w-12 rounded-md" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                        <div className="space-y-2 pt-2">
                            <Skeleton className="h-5 w-24 rounded-md" />
                            <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
                            <Skeleton className="h-4 w-3/4 max-w-xl rounded-md" />
                        </div>
                    </div>
                </div>
            </main>
        </>
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
                <main className="container py-20 text-center">
                    <div className="rounded-2xl bg-red-500/[0.05] border border-red-500/10 p-8 max-w-lg mx-auto">
                        <p className="text-red-500 font-medium">Error loading details: {error?.message ?? 'Unknown error'}</p>
                    </div>
                </main>
            </>
        );
    }

    if (!mediaDetails) {
        return (
            <>
                <Navbar />
                <main className="container py-20 text-center text-muted-foreground">
                    Media not found.
                </main>
            </>
        );
    }

    const title = isMovie ? (mediaDetails as MovieDetails).title : (mediaDetails).name;
    const releaseDate = isMovie ? (mediaDetails as MovieDetails).release_date : (mediaDetails).first_air_date;
    const posterPath = mediaDetails.poster_path;
    const backdropPath = mediaDetails.backdrop_path;
    const overview = mediaDetails.overview;
    const genres = mediaDetails.genres ?? [];
    const rating = mediaDetails.vote_average?.toFixed(1);
    const tagline = mediaDetails.tagline;
    const networks = mediaDetails.networks ?? [];
    const creators = mediaDetails.created_by ?? []; // For TV shows

    return (
        <>
            <Navbar />

            {/* Backdrop Hero — extends behind navbar */}
            <div className="relative -mt-16 w-full h-[50vh] md:h-[60vh] overflow-hidden">
                {backdropPath ? (
                    <img
                        src={getImageUrl(backdropPath, 'original')}
                        alt={`${title} backdrop`}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                        <ImageOff className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                )}
                {/* Multi-layer gradient overlay for smooth blending */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/50 to-transparent" />
            </div>

            {/* Main Content — overlaps backdrop */}
            <main className="container relative z-10 -mt-40 md:-mt-48 pb-12">
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                    {/* Poster */}
                    <div className="w-48 md:w-56 lg:w-64 flex-shrink-0 mx-auto md:mx-0">
                        <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/[0.08]">
                            <img
                                src={posterPath ? getImageUrl(posterPath, 'w500') : '/placeholder.svg'}
                                alt={title}
                                className="w-full h-auto aspect-[2/3] object-cover bg-muted"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                            />
                        </div>
                    </div>

                    {/* Details */}
                    <div className="flex-grow space-y-4 text-center md:text-left pt-2 md:pt-8">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">{title}</h1>

                        {tagline && (
                            <p className="text-base md:text-lg text-muted-foreground italic">"{tagline}"</p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                            {releaseDate && (
                                <span className="font-medium text-foreground/80">{new Date(releaseDate).getFullYear()}</span>
                            )}
                            {rating && rating !== '0.0' && (
                                <>
                                    <span className="text-white/20">|</span>
                                    <span className="flex items-center gap-1.5">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span className="font-medium text-foreground/80">{rating}</span>
                                    </span>
                                </>
                            )}
                            {mediaDetails.runtime > 0 && (
                                <>
                                    <span className="text-white/20">|</span>
                                    <span>{Math.floor(mediaDetails.runtime / 60)}h {mediaDetails.runtime % 60}m</span>
                                </>
                            )}
                        </div>

                        {/* Networks / Streaming Platforms */}
                        {networks && networks.length > 0 && (
                            <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                {Array.from(new Map(networks.map(n => [n.id, n])).values()).map((network) => (
                                    <NetworkBadge key={network.id} network={network} />
                                ))}
                            </div>
                        )}

                        {/* Genres */}
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            {genres.map(genre => (
                                <Badge key={genre.id} variant="outline" className="border-white/[0.1] text-foreground/70">
                                    {genre.name}
                                </Badge>
                            ))}
                        </div>

                        {/* Directed by (movies) / Created by (TV shows) */}
                        {isMovie && directors.length > 0 && (
                            <div className="pt-2 text-center md:text-left">
                                <span className="text-sm text-muted-foreground">Directed by </span>
                                <span className="text-sm font-medium text-foreground/90">
                                    {directors.map((d: CrewMember) => d.name).join(', ')}
                                </span>
                            </div>
                        )}
                        {!isMovie && creators.length > 0 && (
                            <div className="pt-2 text-center md:text-left">
                                <span className="text-sm text-muted-foreground">Created by </span>
                                <span className="text-sm font-medium text-foreground/90">
                                    {creators.map((c) => c.name).join(', ')}
                                </span>
                            </div>
                        )}

                    </div>
                </div>

                {/* Tabs Section */}
                <section className="mt-10 md:mt-14">
                    <Tabs defaultValue="overview" className="w-full">
                        <div className="flex justify-center md:justify-start overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                            <TabsList className="mb-6 bg-white/[0.04] border border-white/[0.08] w-max">
                                <TabsTrigger value="overview" className="data-[state=active]:bg-white/[0.1]">Overview</TabsTrigger>
                                <TabsTrigger value="cast" className="data-[state=active]:bg-white/[0.1]">Cast</TabsTrigger>
                                <TabsTrigger value="trailer" className="data-[state=active]:bg-white/[0.1]">Trailer</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Overview Tab */}
                        <TabsContent value="overview">
                            {overview ? (
                                <div>
                                    <p className="text-base leading-relaxed text-foreground/80 max-w-2xl">
                                        {overview.length > OVERVIEW_CHAR_LIMIT && !overviewExpanded
                                            ? overview.slice(0, OVERVIEW_CHAR_LIMIT).trimEnd() + '...'
                                            : overview}
                                    </p>
                                    {overview.length > OVERVIEW_CHAR_LIMIT && (
                                        <button
                                            onClick={() => setOverviewExpanded(!overviewExpanded)}
                                            className="mt-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {overviewExpanded ? 'Show less' : 'Read more'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No overview available.</p>
                            )}
                        </TabsContent>

                        {/* Cast Tab */}
                        <TabsContent value="cast">
                            {cast.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {cast.map((member: CastMember) => (
                                        <div key={member.id} className="flex flex-col items-center text-center">
                                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-muted/30 border border-white/[0.08] mb-2">
                                                {member.profile_path ? (
                                                    <img
                                                        src={getImageUrl(member.profile_path, 'w185')}
                                                        alt={member.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User className="w-8 h-8 text-muted-foreground/50" />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-foreground/90 line-clamp-1">{member.name}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{member.character}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No cast information available.</p>
                            )}
                        </TabsContent>

                        {/* Trailer Tab */}
                        <TabsContent value="trailer">
                            {trailer ? (
                                <div className="relative w-full max-w-xl rounded-xl overflow-hidden border border-white/[0.08]">
                                    {showTrailer ? (
                                        <div className="aspect-video">
                                            <iframe
                                                src={`https://www.youtube.com/embed/${trailer.key}?rel=0`}
                                                title={trailer.name}
                                                className="w-full h-full"
                                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowTrailer(true)}
                                            className="relative aspect-video w-full group cursor-pointer"
                                        >
                                            <img
                                                src={`https://img.youtube.com/vi/${trailer.key}/maxresdefault.jpg`}
                                                alt={trailer.name}
                                                className="absolute inset-0 w-full h-full object-cover object-center"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${trailer.key}/sddefault.jpg`;
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/30" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-transform group-hover:scale-110">
                                                    <Play className="w-7 h-7 md:w-8 md:h-8 text-white fill-white ml-1" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-4 left-4 text-sm text-white/70">
                                                {trailer.name}
                                            </div>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No trailer available.</p>
                            )}
                        </TabsContent>
                    </Tabs>
                </section>
            </main>
        </>
    );
};

export default MovieDetail;
