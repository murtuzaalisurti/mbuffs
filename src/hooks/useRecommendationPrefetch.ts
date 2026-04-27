import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchCategoryRecommendationsApi,
  fetchUserPreferencesApi,
  warmRecommendationCacheApi,
} from '@/lib/api';
import { useAuth } from './useAuth';
import {
  CATEGORY_OVERVIEW_FETCH_LIMIT,
  getCategoryRecommendationsOverviewQueryKey,
  getPreferencesQueryKey,
  getSharedPersonalizedTheatricalInfiniteQueryOptions,
  getSharedForYouInfiniteQueryOptions,
  FOR_YOU_QUERY_STALE_TIME,
} from '@/lib/recommendationQueries';
import type { UserPreferences } from '@/lib/types';

/**
 * Proactively warms the recommendation cache on the server and prefetches
 * the first page of For You recommendations into the React Query cache.
 *
 * This runs once when the user is authenticated so that recommendations
 * are already cached by the time they navigate to the For You page.
 *
 * Returns `warmRecommendations` - a function that can be called after
 * preference changes (watched/not-interested toggles) to re-warm the
 * server cache in the background.
 */
export function useRecommendationPrefetch() {
  const { user, session } = useAuth();
  const hasConfirmedSession = Boolean(session?.user);
  const queryClient = useQueryClient();
  const hasPrefetchedRef = useRef(false);

  /**
   * Fire-and-forget: tell the server to warm its recommendation cache.
   * Safe to call multiple times - the server uses locks to prevent
   * concurrent regeneration for the same user.
   */
  const warmRecommendations = useCallback(() => {
    if (!hasConfirmedSession) return;
    void warmRecommendationCacheApi().catch(() => {
      // Swallow errors - this is best-effort background work
    });
  }, [hasConfirmedSession]);

  useEffect(() => {
    if (!hasConfirmedSession || !user?.id || hasPrefetchedRef.current) return;
    hasPrefetchedRef.current = true;

    const prefetch = async () => {
      // 1. Warm server cache (fire-and-forget)
      warmRecommendations();

      // 2. Check if recommendations are enabled before prefetching data
      try {
        const preferencesData = await queryClient.fetchQuery<{ preferences: UserPreferences }>({
          queryKey: getPreferencesQueryKey(user.id),
          queryFn: fetchUserPreferencesApi,
          staleTime: 1000 * 60 * 5,
        });

        if (!preferencesData?.preferences?.recommendations_enabled) return;

        if (preferencesData.preferences.category_recommendations_enabled) {
          await Promise.allSettled([
            queryClient.prefetchQuery({
              queryKey: getCategoryRecommendationsOverviewQueryKey(
                user.id,
                'movie',
                CATEGORY_OVERVIEW_FETCH_LIMIT,
              ),
              queryFn: () => fetchCategoryRecommendationsApi('movie', CATEGORY_OVERVIEW_FETCH_LIMIT),
              staleTime: 1000 * 60 * 10,
            }),
            queryClient.prefetchQuery({
              queryKey: getCategoryRecommendationsOverviewQueryKey(
                user.id,
                'tv',
                CATEGORY_OVERVIEW_FETCH_LIMIT,
              ),
              queryFn: () => fetchCategoryRecommendationsApi('tv', CATEGORY_OVERVIEW_FETCH_LIMIT),
              staleTime: 1000 * 60 * 10,
            }),
            queryClient.prefetchInfiniteQuery({
              ...getSharedPersonalizedTheatricalInfiniteQueryOptions(user.id),
              staleTime: FOR_YOU_QUERY_STALE_TIME,
              pages: 1,
            }),
          ]);
        }
      } catch {
        // If we can't check preferences, skip prefetch - not critical
        return;
      }

      // 3. Prefetch the first page of For You recommendations into client cache.
      //    If the server cache is warm this returns near-instantly.
      //    If cold, the warm call above is generating it in the background
      //    and this request will benefit from the stale-while-revalidate
      //    pattern on the server side.
      try {
        await queryClient.prefetchInfiniteQuery({
          ...getSharedForYouInfiniteQueryOptions(user.id),
          staleTime: FOR_YOU_QUERY_STALE_TIME,
          pages: 1,
        });
      } catch {
        // Non-critical - the page will fetch on mount if this fails
      }
    };

    void prefetch();
  }, [hasConfirmedSession, user?.id, queryClient, warmRecommendations]);

  // Reset the prefetch flag on logout so it re-triggers on next login
  useEffect(() => {
    if (!hasConfirmedSession) {
      hasPrefetchedRef.current = false;
    }
  }, [hasConfirmedSession]);

  return { warmRecommendations };
}
