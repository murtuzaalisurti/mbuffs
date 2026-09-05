import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchMbuffPicksApi, getImageUrl } from '@/lib/api';
import type { MbuffPickItem } from '@/lib/types';
import { cn } from '@/lib/utils';

function PickPoster({ item, className }: { item: MbuffPickItem; className?: string }) {
    return (
        <Link
            to={`/media/${item.media_type}/${item.tmdb_id}`}
            title={item.title}
            aria-label={item.title}
            className={cn(
                'group block aspect-2/3 rounded-lg overflow-hidden border border-border/60 bg-muted shadow-sm',
                className
            )}
        >
            <img
                src={getImageUrl(item.poster_path, 'w185')}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
            />
        </Link>
    );
}

function PicksHeading({ className }: { className?: string }) {
    return (
        <span className={cn('font-bold text-amber-400 uppercase tracking-[0.2em] text-[10px]', className)}>
            mbuff picks
        </span>
    );
}

/**
 * "mbuff picks": up to 6 items blending the admin-curated list with community
 * favorites (mbuff score > 8). Rendered below the rating card on movie/TV
 * show/season detail pages. Hidden when there is nothing to show.
 *
 * - `grid`: 2-column poster grid for the desktop sidebar.
 * - `row`: full-bleed horizontal scroll row for mobile screens.
 */
export function MbuffPicks({
    excludeMediaType,
    excludeTmdbId,
    orientation = 'grid',
    className,
}: {
    excludeMediaType?: 'movie' | 'tv';
    excludeTmdbId?: number | string;
    orientation?: 'grid' | 'row';
    className?: string;
}) {
    const canExclude = Boolean(excludeMediaType && excludeTmdbId);
    const { data } = useQuery({
        queryKey: ['mbuff-picks', excludeMediaType ?? null, excludeTmdbId ?? null],
        queryFn: () => fetchMbuffPicksApi(
            canExclude
                ? { mediaType: excludeMediaType as 'movie' | 'tv', tmdbId: excludeTmdbId as number | string }
                : undefined
        ),
        // Picks are randomized per request; the 5-min cache keeps them stable
        // while browsing, then rolls a fresh set afterwards.
        staleTime: 1000 * 60 * 5,
    });

    const items = data?.items ?? [];
    if (items.length === 0) return null;

    if (orientation === 'row') {
        return (
            <section className={cn('space-y-3', className)}>
                <PicksHeading />
                <div className="flex overflow-x-auto gap-2.5 pb-1 snap-x scrollbar-hide">
                    {items.map((item) => (
                        <PickPoster
                            key={`${item.media_type}-${item.tmdb_id}`}
                            item={item}
                            className="shrink-0 w-24 snap-start"
                        />
                    ))}
                </div>
            </section>
        );
    }

    return (
        <div className={cn('rounded-2xl border border-border bg-secondary/40 p-5 space-y-3.5', className)}>
            <div className="flex justify-center">
                <PicksHeading />
            </div>
            <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                    <PickPoster key={`${item.media_type}-${item.tmdb_id}`} item={item} />
                ))}
            </div>
        </div>
    );
}
