import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTvSeasonDetailsApi, fetchTvDetailsApi, getImageUrl } from '@/lib/api';
import { SeasonDetails, Episode, MovieDetails, Season } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { ReviewSection, MbuffScoreCard } from '@/components/reviews/ReviewSection';
import { MbuffPicks } from '@/components/MbuffPicks';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, ArrowLeft, ArrowRight, Clock, ImageOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLLAPSED_EPISODE_COUNT = 3;

const SeasonDetail = () => {
    const { mediaId, seasonNumber } = useParams<{ mediaId: string, seasonNumber: string }>();
    const [episodesExpanded, setEpisodesExpanded] = useState(false);
    const [episodesSeasonNumber, setEpisodesSeasonNumber] = useState(seasonNumber);
    // Collapse the episode list again when navigating between seasons
    if (seasonNumber !== episodesSeasonNumber) {
        setEpisodesSeasonNumber(seasonNumber);
        setEpisodesExpanded(false);
    }
    const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
    const [overviewClamp, setOverviewClamp] = useState<{ lines: number; clipped: boolean } | null>(null);
    const overviewBoxRef = useRef<HTMLDivElement>(null);
    const overviewTextRef = useRef<HTMLParagraphElement>(null);

    const { data: showDetails } = useQuery<MovieDetails | null>({
        queryKey: ['tv', 'details', mediaId],
        queryFn: () => {
            if (!mediaId) throw new Error("ID required");
            return fetchTvDetailsApi(Number(mediaId));
        },
        enabled: !!mediaId,
        staleTime: 1000 * 60 * 60,
    });

    const { data: seasonDetails, isLoading, isError, error } = useQuery<SeasonDetails | null, Error>({
        queryKey: ['tv', mediaId, 'season', seasonNumber],
        queryFn: () => {
            if (!mediaId || !seasonNumber) throw new Error("ID and Season Number required");
            return fetchTvSeasonDetailsApi(Number(mediaId), Number(seasonNumber));
        },
        enabled: !!mediaId && !!seasonNumber,
    });

    const hasMoreEpisodes = (seasonDetails?.episodes.length ?? 0) > COLLAPSED_EPISODE_COUNT;
    const visibleEpisodes = episodesExpanded || !seasonDetails
        ? seasonDetails?.episodes ?? []
        : seasonDetails.episodes.slice(0, COLLAPSED_EPISODE_COUNT);

    // Season ladder: back walks up to the previous season (or the show),
    // next jumps to the following aired season.
    const showSeasons = useMemo(
        () => (showDetails?.seasons ?? []).slice().sort((a, b) => a.season_number - b.season_number),
        [showDetails?.seasons]
    );
    const currentSeasonNumber = Number(seasonNumber);
    const previousSeason = showSeasons.filter((season) => season.season_number < currentSeasonNumber).pop();
    const nextSeason = showSeasons.find((season) =>
        season.season_number > currentSeasonNumber &&
        !!season.air_date && new Date(season.air_date) <= new Date()
    );
    const seasonLabel = (season: Season) => season.name || `Season ${season.season_number}`;

    // Keep the overview clipped to the space beside the poster: measure how many
    // lines fit in the remaining height and detect whether the text overflows.
    useLayoutEffect(() => {
        const box = overviewBoxRef.current;
        const text = overviewTextRef.current;
        if (!box || !text || !seasonDetails?.overview) {
            setOverviewClamp(null);
            return;
        }

        const measure = () => {
            const lineHeight = parseFloat(window.getComputedStyle(text).lineHeight) || 22;
            const lines = Math.max(1, Math.floor(box.clientHeight / lineHeight));
            // scrollHeight includes the lines hidden by -webkit-line-clamp
            const clipped = text.scrollHeight > box.clientHeight + 1;
            setOverviewClamp((prev) => (
                prev?.lines === lines && prev.clipped === clipped ? prev : { lines, clipped }
            ));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(box);
        return () => observer.disconnect();
    }, [seasonDetails?.overview]);

    if (isLoading) {
        return (
            <>
                <Navbar />
                <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden bg-muted/30" style={{ marginTop: 'calc(-4rem - env(safe-area-inset-top))' }}>
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />
                </div>
                <main className="container relative z-10 -mt-32 md:-mt-40 pb-12 space-y-6">
                    <Skeleton className="h-9 w-40 rounded-full" />
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        <div className="flex-1 min-w-0 space-y-6">
                            <div className="flex gap-4 md:gap-5 items-start">
                                <Skeleton className="w-24 md:w-28 aspect-2/3 rounded-xl shrink-0" />
                                <div className="space-y-3 flex-1 pt-1">
                                    <Skeleton className="h-8 w-2/3 max-w-sm" />
                                    <Skeleton className="h-4 w-1/2 max-w-xs" />
                                </div>
                            </div>
                            <Skeleton className="h-28 w-full rounded-xl" />
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-28 w-full rounded-lg" />
                                ))}
                            </div>
                        </div>
                        <aside className="hidden md:block w-56 lg:w-64 shrink-0">
                            <div className="sticky top-20 space-y-4">
                                <Skeleton className="h-64 w-full rounded-2xl" />
                            </div>
                        </aside>
                    </div>
                </main>
            </>
        );
    }

    if (isError || !seasonDetails) {
        return (
            <>
                <Navbar />
                <main className="container py-20 text-center">
                    <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-8 max-w-lg mx-auto">
                        <p className="text-destructive font-medium">Failed to load season details: {error?.message ?? 'Unknown error'}</p>
                    </div>
                    <Button variant="link" asChild className="mt-4">
                        <Link to={`/media/tv/${mediaId}`} className="gap-2 items-center">
                            <ArrowLeft className="w-4 h-4" /> Back to Show
                        </Link>
                    </Button>
                </main>
            </>
        );
    }

    const showName = showDetails?.name;
    const backdropPath = showDetails?.backdrop_path;

    return (
        <>
            <Navbar />

            {/* Backdrop Hero — extends behind navbar, same treatment as the show page */}
            <div
                className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden"
                style={{ marginTop: 'calc(-4rem - env(safe-area-inset-top))' }}
            >
                {backdropPath ? (
                    <img
                        src={getImageUrl(backdropPath, 'original')}
                        alt={`${showName ?? 'Show'} backdrop`}
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
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />
                <div className="absolute inset-0 bg-linear-to-r from-background/50 to-transparent" />
            </div>

            {/* Main Content — overlaps backdrop */}
            <main className="container relative z-10 -mt-32 md:-mt-40 pb-12">
                {/* Season navigation: back walks the season ladder down to the show,
                    next jumps to the following aired season */}
                <div className="mb-6 flex items-center gap-2">
                    <Button
                        variant="ghost"
                        asChild
                        className="pl-2 pr-3 hover:bg-background/60 hover:text-primary gap-2 rounded-full text-muted-foreground min-w-0"
                    >
                        <Link
                            to={previousSeason
                                ? `/tv/${mediaId}/season/${previousSeason.season_number}`
                                : `/media/tv/${mediaId}`}
                            className="min-w-0"
                        >
                            <ArrowLeft className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                                {previousSeason ? seasonLabel(previousSeason) : showName ?? 'Back to Show'}
                            </span>
                        </Link>
                    </Button>

                    {nextSeason && (
                        <Button
                            variant="ghost"
                            asChild
                            className="pl-3 pr-2 hover:bg-background/60 hover:text-primary gap-2 rounded-full text-muted-foreground min-w-0"
                        >
                            <Link to={`/tv/${mediaId}/season/${nextSeason.season_number}`} className="min-w-0">
                                <span className="truncate">{seasonLabel(nextSeason)}</span>
                                <ArrowRight className="w-4 h-4 shrink-0" />
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-8 md:gap-8 lg:gap-10">
                    {/* Left column */}
                    <div className="flex-1 min-w-0 space-y-8">
                        {/* Season header: small poster + title/meta/overview */}
                        <div className="flex gap-4 md:gap-5 items-start">
                            <div className="w-24 md:w-28 shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-border/60 aspect-2/3 bg-muted">
                                {seasonDetails.poster_path ? (
                                    <img
                                        src={getImageUrl(seasonDetails.poster_path, 'w185')}
                                        alt={seasonDetails.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageOff className="w-6 h-6 text-muted-foreground/40" />
                                    </div>
                                )}
                            </div>
                            {/* Text stack — constrained to the poster height so long
                                overviews clip with ellipsis instead of flowing below */}
                            <div className="min-w-0 pt-1 h-[146px] md:h-[170px] flex flex-col">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                                    {seasonDetails.air_date ? new Date(seasonDetails.air_date).getFullYear() : 'TBA'} · Season
                                </p>
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight mt-1">
                                    {seasonDetails.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-3">
                                    <span>{seasonDetails.episodes.length} Episodes</span>
                                    {seasonDetails.vote_average > 0 && (
                                        <>
                                            <span className="text-muted-foreground/40">|</span>
                                            <span className="flex items-center gap-1.5" title="TMDB rating">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                <span className="font-medium text-foreground/80">{seasonDetails.vote_average.toFixed(1)}</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                                {seasonDetails.overview && (
                                    <div
                                        ref={overviewBoxRef}
                                        onClick={overviewClamp?.clipped ? () => setIsOverviewModalOpen(true) : undefined}
                                        role={overviewClamp?.clipped ? 'button' : undefined}
                                        tabIndex={overviewClamp?.clipped ? 0 : undefined}
                                        onKeyDown={overviewClamp?.clipped
                                            ? (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIsOverviewModalOpen(true);
                                                }
                                            }
                                            : undefined}
                                        aria-label={overviewClamp?.clipped ? 'Read full season overview' : undefined}
                                        className={cn(
                                            'mt-3 flex-1 min-h-0 overflow-hidden relative',
                                            overviewClamp?.clipped && 'cursor-pointer group/overview'
                                        )}
                                    >
                                        <p
                                            ref={overviewTextRef}
                                            className={cn(
                                                'text-sm text-muted-foreground leading-relaxed',
                                                overviewClamp?.clipped && 'group-hover/overview:text-foreground/80 transition-colors'
                                            )}
                                            style={overviewClamp?.clipped
                                                ? {
                                                    display: '-webkit-box',
                                                    WebkitBoxOrient: 'vertical',
                                                    WebkitLineClamp: overviewClamp.lines,
                                                    overflow: 'hidden',
                                                }
                                                : undefined}
                                        >
                                            {seasonDetails.overview}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Full season overview modal */}
                        <Dialog open={isOverviewModalOpen} onOpenChange={setIsOverviewModalOpen}>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>{seasonDetails.name}</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                                    {seasonDetails.overview}
                                </p>
                            </DialogContent>
                        </Dialog>

                        {/* Rating: mobile shows it inside the reviews section below;
                            desktop gets the sticky sidebar card */}

                        {/* Episodes — collapsed by default with a fade-out reveal */}
                        <section className="space-y-5">
                            <h2 className="text-xl md:text-2xl font-semibold text-foreground/90">Episodes</h2>
                            <div
                                className={cn(
                                    'grid gap-4',
                                    hasMoreEpisodes && !episodesExpanded &&
                                        '[mask-image:linear-gradient(to_bottom,black_55%,transparent_96%)]'
                                )}
                            >
                                {visibleEpisodes.map((episode: Episode, index: number) => (
                                    <div
                                        key={episode.id}
                                        className={cn(
                                            'flex flex-row bg-card hover:bg-accent/50 transition-colors rounded-lg overflow-hidden border border-border/50 group',
                                            // Show only 2 episodes on mobile, 3 on larger screens while collapsed
                                            !episodesExpanded && index === COLLAPSED_EPISODE_COUNT - 1 && 'hidden sm:flex'
                                        )}
                                    >
                                        {/* Episode Still — compact thumbnail on mobile, wide on desktop */}
                                        <div className="w-32 sm:w-40 md:w-48 aspect-video shrink-0 relative bg-muted">
                                            {episode.still_path ? (
                                                <img
                                                    src={getImageUrl(episode.still_path, 'w300')}
                                                    alt={episode.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageOff className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground/30" />
                                                </div>
                                            )}
                                            <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 bg-background/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-medium text-foreground/90">
                                                Ep {episode.episode_number}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-3 md:p-4 flex flex-col justify-center flex-1 min-w-0 gap-1.5 md:gap-2">
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="font-medium text-sm md:text-lg line-clamp-1 group-hover:text-primary transition-colors">
                                                        {episode.name}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] md:text-xs text-muted-foreground mt-1">
                                                        {episode.air_date && (
                                                            <span>{new Date(episode.air_date).toLocaleDateString()}</span>
                                                        )}
                                                        {episode.runtime && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {episode.runtime}m
                                                            </span>
                                                        )}
                                                        {episode.vote_average > 0 && (
                                                            <span className="flex items-center gap-1 text-yellow-500/80">
                                                                <Star className="w-3 h-3 fill-current" />
                                                                {episode.vote_average.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 md:line-clamp-3 leading-relaxed">
                                                {episode.overview || "No overview available."}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasMoreEpisodes && (
                                <div className={cn('flex justify-center', !episodesExpanded && '-mt-6 relative z-10')}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground text-xs bg-background/80 backdrop-blur-sm rounded-full"
                                        onClick={() => setEpisodesExpanded((expanded) => !expanded)}
                                        aria-expanded={episodesExpanded}
                                    >
                                        {episodesExpanded ? (
                                            <>
                                                <ChevronUp className="h-3.5 w-3.5 mr-1.5" />
                                                Show fewer episodes
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                                                Show all {seasonDetails.episodes.length} episodes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* Ratings & Reviews for this season */}
                        {mediaId && seasonNumber && (
                            <>
                                <ReviewSection
                                    mediaType="tv"
                                    tmdbId={Number(mediaId)}
                                    seasonNumber={Number(seasonNumber)}
                                />

                                {/* mbuff picks on mobile: horizontal row below reviews */}
                                <MbuffPicks
                                    orientation="row"
                                    excludeMediaType="tv"
                                    excludeTmdbId={Number(mediaId)}
                                    className="md:hidden"
                                />
                            </>
                        )}
                    </div>

                    {/* Right sidebar - rating card (desktop only, like the show page) */}
                    <aside className="hidden md:block w-56 lg:w-64 shrink-0">
                        <div className="sticky top-20">
                            {mediaId && seasonNumber && (
                                <MbuffScoreCard
                                    mediaType="tv"
                                    tmdbId={Number(mediaId)}
                                    seasonNumber={Number(seasonNumber)}
                                />
                            )}
                            {mediaId && (
                                <MbuffPicks
                                    excludeMediaType="tv"
                                    excludeTmdbId={Number(mediaId)}
                                    className="mt-4"
                                />
                            )}
                        </div>
                    </aside>
                </div>
            </main>
        </>
    );
};

export default SeasonDetail;
