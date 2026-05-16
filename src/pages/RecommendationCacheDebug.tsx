import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Database, RefreshCw, ShieldAlert, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import {
  fetchRecommendationCacheDebugApi,
  invalidateRecommendationCacheDebugApi,
} from '@/lib/api';
import {
  RecommendationCacheDebugInvalidateMode,
  RecommendationCacheDebugInvalidateResponse,
  RecommendationCacheDebugResponse,
} from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const CACHE_DEBUG_QUERY_KEY = ['recommendations', 'cache', 'debug'];

const formatDateTime = (value: string | null) => {
  if (!value) return 'n/a';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatRelative = (value: string | null) => {
  if (!value) return 'n/a';

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return value;

  const diffMs = ms - Date.now();
  const absMs = Math.abs(diffMs);
  const absSeconds = Math.round(absMs / 1000);

  if (absSeconds < 60) {
    return diffMs >= 0 ? `in ${absSeconds}s` : `${absSeconds}s ago`;
  }

  const absMinutes = Math.round(absSeconds / 60);
  if (absMinutes < 60) {
    return diffMs >= 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
  }

  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const RecommendationCacheDebug = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RecommendationCacheDebugResponse, Error>({
    queryKey: CACHE_DEBUG_QUERY_KEY,
    queryFn: fetchRecommendationCacheDebugApi,
    staleTime: 30 * 1000,
  });

  const invalidateMutation = useMutation<
    RecommendationCacheDebugInvalidateResponse,
    Error,
    { mode: RecommendationCacheDebugInvalidateMode; warm: boolean }
  >({
    mutationFn: ({ mode, warm }) => invalidateRecommendationCacheDebugApi(mode, { warm }),
    onSuccess: (result) => {
      queryClient.setQueryData(CACHE_DEBUG_QUERY_KEY, result);
      const warmText = result.warm_started ? ' Warm triggered.' : '';
      toast.success(`${result.message}.${warmText}`.trim());
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Failed to update recommendation cache.');
    },
  });

  const handleInvalidate = async (
    mode: RecommendationCacheDebugInvalidateMode,
    warm: boolean,
  ) => {
    if (mode === 'hard') {
      const confirmed = window.confirm('Hard invalidation clears all cache rows immediately. Continue?');
      if (!confirmed) {
        return;
      }
    }

    await invalidateMutation.mutateAsync({ mode, warm });
  };

  const cache = data?.cache;
  const entries = cache?.entries ?? [];
  const nowMs = Date.now();

  const activeEntries = entries.filter((entry) => entry.slot === 'active');
  const stagingEntries = entries.filter((entry) => entry.slot === 'staging');
  const activeFresh = activeEntries.filter((entry) => new Date(entry.expires_at).getTime() > nowMs).length;
  const activeExpired = activeEntries.length - activeFresh;
  const generationLocks = entries.filter((entry) => Boolean(entry.generation_started_at)).length;

  const isMutating = invalidateMutation.isPending;

  return (
    <>
      <Navbar />
      <main className="container py-6 md:py-10">
        <section className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Recommendation Cache</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Debug view for recommendation snapshots (TTL: {data?.ttl_minutes ?? 30} minutes).
            </p>
          </div>

          <Button onClick={() => refetch()} disabled={isFetching || isMutating} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </section>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Unable to load cache debug
              </CardTitle>
              <CardDescription>{error?.message || 'This endpoint may be restricted to authorized users.'}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cache Controls</CardTitle>
                <CardDescription>
                  Use soft expire to keep serving stale active cache while background refresh runs.
                  Use hard invalidate only when you need a full reset.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void handleInvalidate('soft', true)}
                  disabled={isMutating || isFetching}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Soft Expire + Warm
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleInvalidate('hard', true)}
                  disabled={isMutating || isFetching}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Hard Invalidate + Warm
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Entries</CardDescription>
                  <CardTitle className="text-3xl">{cache?.total ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Rows</CardDescription>
                  <CardTitle className="text-3xl">{activeEntries.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Staging Rows</CardDescription>
                  <CardTitle className="text-3xl">{stagingEntries.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Fresh</CardDescription>
                  <CardTitle className="text-3xl text-emerald-500">{activeFresh}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Expired</CardDescription>
                  <CardTitle className="text-3xl text-amber-500">{activeExpired}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Generation Locks</CardDescription>
                  <CardTitle className="text-3xl text-sky-500">{generationLocks}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Entries
                </CardTitle>
                <CardDescription>
                  Showing newest entries first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!entries.length ? (
                  <p className="text-sm text-muted-foreground">No cached recommendation entries found yet.</p>
                ) : (
                  <div className="space-y-3">
                    {entries.map((entry) => {
                      const isFresh = new Date(entry.expires_at).getTime() > nowMs;

                      return (
                        <div
                          key={`${entry.cache_key}-${entry.slot}-${entry.updated_at}`}
                          className="rounded-lg border p-3 bg-card/50"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant={isFresh ? 'default' : 'secondary'}>
                              {isFresh ? 'fresh' : 'expired'}
                            </Badge>
                            <Badge variant={entry.slot === 'active' ? 'default' : 'outline'}>{entry.slot}</Badge>
                            <Badge variant="outline">{entry.cache_version}</Badge>
                            <Badge variant="outline">{formatBytes(entry.payload_size)}</Badge>
                            {entry.generation_started_at ? (
                              <Badge variant="secondary">generating</Badge>
                            ) : null}
                          </div>

                          <p className="text-xs text-muted-foreground break-all">{entry.cache_key}</p>

                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" /> Expires {formatDateTime(entry.expires_at)} ({formatRelative(entry.expires_at)})
                            </span>
                            <span>Created {formatDateTime(entry.created_at)}</span>
                            <span>Updated {formatDateTime(entry.updated_at)}</span>
                            <span>
                              Generation started {formatDateTime(entry.generation_started_at)}
                              {entry.generation_started_at ? ` (${formatRelative(entry.generation_started_at)})` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </>
  );
};

export default RecommendationCacheDebug;
