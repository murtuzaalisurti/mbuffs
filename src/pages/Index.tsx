import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MovieCard } from "@/components/MovieCard";
import { MediaRail } from "@/components/MediaRail";
import { Rail, RailSkeleton } from "@/components/Rail";
import { CollageHero } from "@/components/CollageHero";
import { fetchTrendingContentApi, fetchNowPlayingSortedApi, fetchUserPreferencesApi, fetchCollageItemsPublicApi } from "@/lib/api";
import { useAuth } from '@/hooks/useAuth';
import { useWatchedStatus } from '@/hooks/useWatchedStatus';
import { useNotInterestedStatus } from '@/hooks/useNotInterestedStatus';
import { useUserRegion } from '@/hooks/useUserRegion';
import { Settings, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserPreferences } from '@/lib/types';
import {
  dedupeForYouRecommendations,
  excludeFeedbackRecommendations,
  getRecommendationMediaId,
  getPreferencesQueryKey,
  getSharedForYouInfiniteQueryOptions,
  selectForYouPreviewRecommendations,
} from '@/lib/recommendationQueries';

const TRENDING_CONTENT_QUERY_KEY = ['content', 'trending'];
const NOW_PLAYING_QUERY_KEY = ['content', 'now-playing'];
const COLLAGE_QUERY_KEY = ['content', 'collage'];

/** Small deterministic PRNG (mulberry32), so a shuffle can be repeated from its seed. */
const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const Index = () => {
  const { user } = useAuth();

  // Fetch user preferences separately
  const { data: preferencesData } = useQuery<{ preferences: UserPreferences }, Error>({
    queryKey: getPreferencesQueryKey(user?.id),
    queryFn: fetchUserPreferencesApi,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const recommendationsEnabled = preferencesData?.preferences?.recommendations_enabled ?? false;

  // Visitor's region (remembered from the last visit, refreshed in the background)
  const { data: userRegion } = useUserRegion();

  const {
    data: trendingContentData,
    isLoading: isTrendingContentLoading,
  } = useQuery({
    queryKey: [TRENDING_CONTENT_QUERY_KEY],
    queryFn: () => fetchTrendingContentApi(1),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes to reduce API calls
  });

  // Fetch now playing movies for the user's region (falls back to US until region resolves)
  const {
    data: nowPlayingData,
    isLoading: isNowPlayingLoading,
  } = useQuery({
    queryKey: [NOW_PLAYING_QUERY_KEY, userRegion],
    queryFn: () => fetchNowPlayingSortedApi(1, userRegion),
    enabled: !!userRegion, // wait until region resolves so we fetch once with the right region
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes to reduce API calls
  });

  // Fetch admin-curated collage items for the hero section
  const { data: collageData } = useQuery({
    queryKey: COLLAGE_QUERY_KEY,
    queryFn: fetchCollageItemsPublicApi,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch personalized recommendations for logged in users with recommendations enabled
  const {
    data: recommendationsData,
    isLoading: isRecommendationsLoading,
  } = useInfiniteQuery({
    ...getSharedForYouInfiniteQueryOptions(user?.id),
    enabled: !!user && recommendationsEnabled,
  });

  const trendingContent = useMemo(() => trendingContentData?.results?.slice(0, 50) || [], [trendingContentData]);
  const nowPlayingContent = nowPlayingData?.results || [];
  const collageItems = useMemo(() => collageData?.items ?? [], [collageData]);
  const collageMinItems = collageData?.minItems ?? 12;
  // One random seed per visit keeps the shuffle stable across re-renders
  const [shuffleSeed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const heroPosters = useMemo(() => {
    const random = seededRandom(shuffleSeed);
    const collagePosters = collageItems.map((item) => ({ id: item.tmdb_id, poster_path: item.poster_path }));
    for (let i = collagePosters.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [collagePosters[i], collagePosters[j]] = [collagePosters[j], collagePosters[i]];
    }
    if (collagePosters.length >= collageMinItems) return collagePosters;
    const existingIds = new Set(collagePosters.map((p) => p.id));
    const trendingFill = trendingContent
      .filter((m) => !existingIds.has(String(m.id)))
      .map((m) => ({ id: String(m.id), poster_path: m.poster_path }));
    return [...collagePosters, ...trendingFill];
  }, [collageItems, collageMinItems, trendingContent, shuffleSeed]);
  const firstRecommendationsPage = recommendationsData?.pages?.[0];
  const recommendationCandidates = useMemo(
    () => dedupeForYouRecommendations(firstRecommendationsPage?.results ?? []),
    [firstRecommendationsPage]
  );

  // Generate media IDs for watched status lookup (recommendations only)
  const recommendationMediaIds = useMemo(
    () => recommendationCandidates.map((movie) => getRecommendationMediaId(movie)),
    [recommendationCandidates]
  );

  const { watchedMap, isLoading: isLoadingWatched } = useWatchedStatus(recommendationMediaIds);
  const { notInterestedMap, isLoading: isLoadingNotInterested } = useNotInterestedStatus(recommendationsEnabled ? recommendationMediaIds : []);
  const recommendations = useMemo(
    () => selectForYouPreviewRecommendations(
      excludeFeedbackRecommendations(
        recommendationCandidates,
        watchedMap,
        recommendationsEnabled ? notInterestedMap : {},
      ).filter((movie) => movie.poster_path),
    ),
    [recommendationCandidates, watchedMap, notInterestedMap, recommendationsEnabled]
  );
  const hasRecommendations = recommendationsEnabled && recommendations.length > 0;

  const forYouSubtitle = (firstRecommendationsPage?.totalSourceItems || 0) > 0
    ? `Based on ${firstRecommendationsPage?.totalSourceItems || 0} items from ${firstRecommendationsPage?.sourceCollections?.length || 0} collection${(firstRecommendationsPage?.sourceCollections?.length || 0) !== 1 ? 's' : ''}`
    : 'Add source collections to personalize your recommendations';

  return (
    <>
      {/* Hero Section — full viewport width, extends behind navbar */}
      <CollageHero posters={heroPosters} />

      <main className="container py-6 md:py-10">
        <div className="space-y-12 md:space-y-16">
          {/* For You - Personalized Recommendations */}
          {user && recommendationsEnabled && (
            (isRecommendationsLoading || isLoadingWatched || isLoadingNotInterested) ? (
              <RailSkeleton />
            ) : hasRecommendations ? (
              <Rail
                title={
                  <span className="flex items-center gap-3">
                    For You
                    <span className="font-sans text-xs font-medium normal-case tracking-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Beta
                    </span>
                  </span>
                }
                subtitle={forYouSubtitle}
                action={
                  <Link to="/for-you" viewTransition className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span>See all</span>
                    <ChevronRight className="h-4 w-4 transition-transform duration-(--dur-ui) ease-(--ease-out) group-hover:translate-x-0.5" />
                  </Link>
                }
              >
                {recommendations.map((movie) => {
                  const mediaId = getRecommendationMediaId(movie);
                  return (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      isWatched={watchedMap[mediaId] ?? false}
                      isNotInterested={notInterestedMap[mediaId] ?? false}
                      showNotInterested={recommendationsEnabled}
                      imageSizes="(min-width: 768px) 180px, (min-width: 640px) 160px, 140px"
                    />
                  );
                })}
              </Rail>
            ) : (
              <section className="rounded-2xl bg-linear-to-br from-primary/5 via-muted/40 to-transparent border border-primary/10 p-6 md:p-8 animate-fade-in-up">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">Get Personalized Recommendations</h3>
                    <p className="text-sm text-muted-foreground">
                      Select source collections in your profile settings to see recommendations tailored to your taste.
                    </p>
                  </div>
                  <Link to="/profile">
                    <Button variant="outline" className="whitespace-nowrap">
                      <Settings className="h-4 w-4 mr-2" />
                      Set Up Now
                    </Button>
                  </Link>
                </div>
              </section>
            )
          )}

          {isTrendingContentLoading ? (
            <RailSkeleton />
          ) : trendingContent.length > 0 && (
            <MediaRail title="Trending This Week" movies={trendingContent} collapsible />
          )}

          {/* Now Playing — region specific */}
          {isNowPlayingLoading ? (
            <RailSkeleton />
          ) : nowPlayingContent.length > 0 && (
            <MediaRail title="Now Playing" movies={nowPlayingContent} collapsible />
          )}
        </div>
      </main>
    </>
  );
};

export default Index;
