import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { useWatchedStatus } from "@/hooks/useWatchedStatus";
import { useNotInterestedStatus } from "@/hooks/useNotInterestedStatus";
import { useOmdbRatings, enrichMoviesWithImdbRatings } from "@/hooks/useOmdbRatings";
import { prefersReducedMotion } from "@/lib/motionPreference";
import { bestRating, rankMosaicTiers, type MosaicTier } from "@/lib/mosaicTiers";

const TIER_CLASSES: Record<MosaicTier, string> = {
  large: "col-span-2 row-span-2",
  small: "",
};

// Rendered tile widths per tier, matching the mosaic-grid column counts
const TIER_IMAGE_SIZES: Record<MosaicTier, string> = {
  large: "(min-width: 768px) 200px, (min-width: 640px) 50vw, 66vw",
  small: "(min-width: 768px) 100px, (min-width: 640px) 25vw, 33vw",
};

interface MediaMosaicProps {
  title: ReactNode;
  subtitle?: ReactNode;
  movies: Movie[];
  showNotInterested?: boolean;
}

/**
 * A titled masonry of media cards; the best rated titles get large tiles. Shows a few rows at first; the title (or the button under the
 * fade) reveals the rest.
 */
export function MediaMosaic({ title, subtitle, movies, showNotInterested = false }: MediaMosaicProps) {
  const visibleMovies = useMemo(() => movies.filter((movie) => movie.poster_path), [movies]);

  const mediaIds = useMemo(
    () => visibleMovies.map((movie) => (movie.first_air_date ? `${movie.id}tv` : String(movie.id))),
    [visibleMovies]
  );
  const { watchedMap } = useWatchedStatus(mediaIds);
  const { notInterestedMap } = useNotInterestedStatus(showNotInterested ? mediaIds : []);
  const { ratingsMap, rottenTomatoesMap } = useOmdbRatings(visibleMovies);
  const enrichedMovies = useMemo(
    () => enrichMoviesWithImdbRatings(visibleMovies, ratingsMap),
    [visibleMovies, ratingsMap]
  );
  const tiers = rankMosaicTiers(
    enrichedMovies.map((movie) =>
      bestRating(movie, rottenTomatoesMap[`${movie.first_air_date ? "tv" : "movie"}:${movie.id}`])
    )
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Pixel height while the grid animates open; "none" once it has settled
  const [openHeight, setOpenHeight] = useState<string | null>(null);
  const [overflows, setOverflows] = useState(true);

  // Only offer the toggle when the collapsed rows actually hide something
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || expanded) return;
    const measure = () => setOverflows(grid.scrollHeight > grid.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [expanded, enrichedMovies]);

  // Tiles cut off by the collapsed edge stay out of the tab order
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const tiles = [...grid.children] as HTMLElement[];
    if (expanded) {
      tiles.forEach((tile) => (tile.inert = false));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) (entry.target as HTMLElement).inert = !entry.isIntersecting;
      },
      { root: grid, threshold: 0.6 }
    );
    tiles.forEach((tile) => observer.observe(tile));
    return () => observer.disconnect();
  }, [expanded, enrichedMovies]);

  const toggle = () => {
    const grid = gridRef.current;
    if (!expanded && grid && !prefersReducedMotion()) {
      setOpenHeight(`${grid.scrollHeight}px`);
    } else {
      setOpenHeight(null);
    }
    setExpanded(!expanded);
  };

  if (enrichedMovies.length === 0) return null;

  const collapsedHeight =
    "calc(var(--mosaic-row) * var(--mosaic-peek) + var(--mosaic-gap) * (var(--mosaic-peek) - 1) + 0.5rem)";
  const clipped = !expanded && overflows;

  return (
    <section className="space-y-4 reveal">
      <header className="min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          disabled={!overflows && !expanded}
          className="group flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <h2 className="section-title">{title}</h2>
          {(overflows || expanded) && (
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-(--dur-ui) ease-(--ease-emph) group-hover:text-foreground ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>

      <div className="@container relative">
        <div
          ref={gridRef}
          // Padding gives hover lift and glow room inside the clip
          className={`mosaic-grid -mx-2 -mt-2 px-2 pt-2 pb-1 overflow-hidden transition-[max-height] duration-(--dur-scene) ease-(--ease-out) ${
            clipped ? "mask-b-from-[calc(100%-6rem)] mask-b-to-100%" : ""
          }`}
          style={{ maxHeight: expanded ? openHeight ?? "none" : collapsedHeight }}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && expanded) setOpenHeight(null);
          }}
        >
          {enrichedMovies.map((movie, index) => {
            const mediaId = movie.first_air_date ? `${movie.id}tv` : String(movie.id);
            const tier = tiers[index];
            return (
              <div key={movie.id} className={`min-h-0 ${TIER_CLASSES[tier]}`}>
                <MovieCard
                  movie={movie}
                  fill
                  isWatched={watchedMap[mediaId] ?? false}
                  isNotInterested={notInterestedMap[mediaId] ?? false}
                  showNotInterested={showNotInterested}
                  imageSizes={TIER_IMAGE_SIZES[tier]}
                />
              </div>
            );
          })}
        </div>

        {clipped && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <button
              type="button"
              onClick={toggle}
              className="rounded-full glass px-4 py-1.5 text-sm font-medium text-foreground ring-1 ring-border shadow-lg shadow-black/40 transition-[scale] duration-(--dur-ui) ease-(--ease-out) hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show all
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default MediaMosaic;
