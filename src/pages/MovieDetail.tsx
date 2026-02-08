import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMovieDetailsApi, fetchTvDetailsApi, fetchVideosApi, fetchCreditsApi, fetchUserCollectionsApi, fetchCollectionDetailsApi, addMovieToCollectionApi, removeMovieFromCollectionApi, getImageUrl, fetchUserRegion } from '@/lib/api';
import { MovieDetails, Network, Video, CastMember, CrewMember, CollectionSummary, WatchProvider } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ImageOff, Star, Play, User, Bookmark, MoreHorizontal, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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

function ProviderList({ title, providers }: { title: string, providers: WatchProvider[] | undefined }) {
    if (!providers || providers.length === 0) return null;
    return (
        <div className="flex flex-col gap-2 items-center md:items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
                {providers.map(p => (
                    <div key={p.provider_id} className="relative group" title={p.provider_name}>
                        <img 
                            src={`${TMDB_LOGO_BASE}${p.logo_path}`} 
                            alt={p.provider_name} 
                            className="w-10 h-10 rounded-md shadow-md border border-white/[0.08] transition-transform group-hover:scale-105"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const OVERVIEW_CHAR_LIMIT = 150;

const MovieDetail = () => {
    const { mediaType, mediaId } = useParams<{ mediaType: 'movie' | 'tv', mediaId: string }>();
    const { isLoggedIn } = useAuth();
    const queryClient = useQueryClient();

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

    // Fetch user collections (only if logged in)
    const { data: collectionsData, isLoading: isLoadingCollections } = useQuery({
        queryKey: ['collections', 'user'],
        queryFn: fetchUserCollectionsApi,
        enabled: isLoggedIn,
        staleTime: 1000 * 60 * 5,
    });

    // Fetch user's region for watch providers
    const { data: userRegion } = useQuery({
        queryKey: ['userRegion'],
        queryFn: fetchUserRegion,
        staleTime: Infinity,
    });

    // Construct the media ID as stored in collections (TV shows have 'tv' suffix)
    const collectionMediaId = isMovie ? mediaId : `${mediaId}tv`;

    // Fetch details for each collection to check if current movie/show is in it
    const collections = collectionsData?.collections ?? [];
    const movieStatusQueryKey = ['collections', 'movie-status', collectionMediaId];
    const { data: movieStatusMap, isLoading: isLoadingMovieStatus, refetch: refetchMovieStatus } = useQuery({
        queryKey: movieStatusQueryKey,
        queryFn: async () => {
            const results = await Promise.all(
                collections.map(async (collection: CollectionSummary) => {
                    const details = await fetchCollectionDetailsApi(collection.id);
                    // movie_id is stored as string, with 'tv' suffix for TV shows
                    const hasMedia = details?.movies?.some(
                        m => String(m.movie_id) === collectionMediaId
                    ) ?? false;
                    return { collectionId: collection.id, hasMedia };
                })
            );
            return results.reduce((acc, { collectionId, hasMedia }) => {
                acc[collectionId] = hasMedia;
                return acc;
            }, {} as Record<string, boolean>);
        },
        enabled: isLoggedIn && collections.length > 0 && !!mediaId && !!mediaType,
    });

    // Check if movie is in at least one collection
    const isInAnyCollection = movieStatusMap ? Object.values(movieStatusMap).some(Boolean) : false;

    // Add movie to collection mutation
    const addToCollectionMutation = useMutation({
        mutationFn: ({ collectionId }: { collectionId: string }) => 
            addMovieToCollectionApi(collectionId, { movieId: collectionMediaId as unknown as number }), // API expects number but handles string with 'tv' suffix
        onSuccess: (_, { collectionId }) => {
            toast.success('Added to collection');
            refetchMovieStatus();
            queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
        },
        onError: (error: Error & { data?: { message?: string } }) => {
            if (error?.data?.message?.includes('already exists')) {
                toast.warning('Already in this collection');
            } else {
                toast.error(`Failed to add: ${error.message}`);
            }
        },
    });

    // Remove movie from collection mutation
    const removeFromCollectionMutation = useMutation({
        mutationFn: ({ collectionId }: { collectionId: string }) => 
            removeMovieFromCollectionApi(collectionId, collectionMediaId!),
        onSuccess: (_, { collectionId }) => {
            toast.success('Removed from collection');
            refetchMovieStatus();
            queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
        },
        onError: (error: Error) => {
            toast.error(`Failed to remove: ${error.message}`);
        },
    });

    const handleCollectionToggle = (collectionId: string, isCurrentlyInCollection: boolean) => {
        if (isCurrentlyInCollection) {
            removeFromCollectionMutation.mutate({ collectionId });
        } else {
            addToCollectionMutation.mutate({ collectionId });
        }
    };

    const [showTrailer, setShowTrailer] = useState(false);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [collectionsOpen, setCollectionsOpen] = useState(false);

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
                    <div className="flex-grow flex flex-col items-center md:items-start space-y-4 pt-2 md:pt-8 w-full">
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
                        <div className="space-y-2 pt-2 w-full flex flex-col items-center md:items-start">
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
    const watchProviders = mediaDetails['watch/providers']?.results?.[userRegion || 'US'];

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
                            {genres.length > 0 && (
                                <>
                                    <span className="hidden md:inline text-white/20">|</span>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                        {genres.map(genre => (
                                            <Badge key={genre.id} variant="outline" className="border-white/[0.1] text-foreground/70 px-2 py-0 h-5 text-xs font-normal">
                                                {genre.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </>
                            )}
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

                        {/* Watch Providers */}
                        {watchProviders && (
                            <div className="pt-4 space-y-4">
                                {watchProviders.flatrate && watchProviders.flatrate.length > 0 ? (
                                    <ProviderList title="Stream" providers={watchProviders.flatrate} />
                                ) : (
                                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                                        <ProviderList title="Rent" providers={watchProviders.rent} />
                                        <ProviderList title="Buy" providers={watchProviders.buy} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Add to Collection Button */}
                        {isLoggedIn && (
                            <div className="pt-4 flex justify-center md:justify-start">
                                <Popover open={collectionsOpen} onOpenChange={setCollectionsOpen}>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className="border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground/90 gap-2"
                                        >
                                            <Bookmark className={`h-4 w-4 ${isInAnyCollection ? 'fill-current' : ''}`} />
                                            <span>Save</span>
                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-0 border-border bg-popover shadow-xl shadow-black/50" align="start">
                                        <div className="px-4 py-3 border-b border-border">
                                            <p className="text-sm font-semibold text-foreground">
                                                Save to collection
                                            </p>
                                        </div>
                                        <div className="p-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {isLoadingCollections || isLoadingMovieStatus ? (
                                                <div className="flex items-center justify-center py-6">
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : collectionsData?.collections?.length === 0 ? (
                                                <div className="py-6 px-4 text-center">
                                                    <p className="text-sm text-muted-foreground">
                                                        No collections yet
                                                    </p>
                                                    <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-primary" asChild>
                                                        <a href="/collections">Create one</a>
                                                    </Button>
                                                </div>
                                            ) : (
                                                collectionsData?.collections?.map((collection: CollectionSummary) => {
                                                    const isInCollection = movieStatusMap?.[collection.id] ?? false;
                                                    const isPending = addToCollectionMutation.isPending || removeFromCollectionMutation.isPending;
                                                    
                                                    return (
                                                        <div
                                                            key={collection.id}
                                                            className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 cursor-pointer transition-all group"
                                                            onClick={() => !isPending && handleCollectionToggle(collection.id, isInCollection)}
                                                        >
                                                            <Checkbox 
                                                                checked={isInCollection}
                                                                disabled={isPending}
                                                                onCheckedChange={() => handleCollectionToggle(collection.id, isInCollection)}
                                                                className="pointer-events-none rounded-full w-5 h-5 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all group-hover:border-muted-foreground/50"
                                                            />
                                                            <span className={`text-sm truncate flex-1 transition-colors ${isInCollection ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                                                {collection.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
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
                                <div className="flex flex-col items-center md:items-start text-center md:text-left">
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
                                <p className="text-muted-foreground text-center md:text-left">No overview available.</p>
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
                                <div className="relative w-full max-w-xl rounded-xl overflow-hidden border border-white/[0.08] mx-auto md:mx-0">
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
