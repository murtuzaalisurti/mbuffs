import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MovieCard } from "@/components/MovieCard";
import { MediaRail } from "@/components/MediaRail";
import { Rail, RailSkeleton } from "@/components/Rail";
import { FeaturedHero } from "@/components/FeaturedHero";
import { fetchTrendingContentApi, fetchNowPlayingSortedApi, fetchUserPreferencesApi } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { useAuth } from '@/hooks/useAuth';
import { useWatchedStatus } from '@/hooks/useWatchedStatus';
import { useNotInterestedStatus } from '@/hooks/useNotInterestedStatus';
import { useUserRegion } from '@/hooks/useUserRegion';
import { Settings } from 'lucide-react';
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
const FEATURED_COUNT = 5;
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
  const featuredItems = useMemo(
    () => trendingContent.filter((item) => item.backdrop_path && item.poster_path).slice(0, FEATURED_COUNT),
    [trendingContent]
  );
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
    ? `Based on ${firstRecommendationsPage?.totalSourceItems || 0} titles from ${firstRecommendationsPage?.sourceCollections?.length || 0} collection${(firstRecommendationsPage?.sourceCollections?.length || 0) !== 1 ? 's' : ''}`
    : 'Add source collections to personalize your recommendations';

  return (
    <>
      <Navbar />

      {featuredItems.length > 0 ? (
        <FeaturedHero items={featuredItems} />
      ) : (
        // Holds the hero's space while trending loads, so the page doesn't jump
        <div
          aria-hidden
          className="h-[72svh] min-h-[460px] max-h-[780px] bg-linear-to-t from-background to-muted/40 animate-shimmer"
          style={{ marginTop: 'calc(-4rem - env(safe-area-inset-top))' }}
        />
      )}

      <main className="container pt-4 pb-12 md:pt-8">
        <div className="space-y-12 md:space-y-16">
          {/* For You - Personalized Recommendations */}
          {user && recommendationsEnabled && (
            (isRecommendationsLoading || isLoadingWatched || isLoadingNotInterested) ? (
              <RailSkeleton />
            ) : hasRecommendations ? (
              <Rail
                title="For you"
                subtitle={forYouSubtitle}
                action={
                  <Link to="/for-you" viewTransition className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    See all
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
                      imageSizes="(min-width: 768px) 172px, (min-width: 640px) 152px, 132px"
                    />
                  );
                })}
              </Rail>
            ) : (
              <section className="rounded-2xl bg-foreground/4 p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-1">Recommendations, just for you</h2>
                    <p className="text-sm text-muted-foreground">
                      Pick the collections that reflect your taste and we'll find what to watch next.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full whitespace-nowrap">
                    <Link to="/profile">
                      <Settings className="h-4 w-4" />
                      Set up
                    </Link>
                  </Button>
                </div>
              </section>
            )
          )}

          {isTrendingContentLoading ? (
            <RailSkeleton />
          ) : trendingContent.length > 0 && (
            <MediaRail title="Trending this week" movies={trendingContent} />
          )}

          {/* Now Playing — region specific */}
          {isNowPlayingLoading ? (
            <RailSkeleton />
          ) : nowPlayingContent.length > 0 && (
            <MediaRail title="Now playing" subtitle="In cinemas near you" movies={nowPlayingContent} />
          )}
        </div>
      </main>
    </>
  );
};

export default Index;
