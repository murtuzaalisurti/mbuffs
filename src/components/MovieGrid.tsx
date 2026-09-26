import { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { useWatchedStatus } from "@/hooks/useWatchedStatus";
import { useNotInterestedStatus } from "@/hooks/useNotInterestedStatus";
import { useOmdbRatings, enrichMoviesWithImdbRatings } from "@/hooks/useOmdbRatings";
import { useMemo, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MovieGridProps {
  movies: Movie[];
  title?: string;
  showNotInterested?: boolean;
  hideItemsWithoutPoster?: boolean;
  /** Wraps the section in a collapsible with a dropdown arrow next to the title. When collapsed, the first row stays visible. */
  collapsible?: boolean;
  /** Whether the collapsible starts expanded (only used when collapsible is true). Defaults to collapsed. */
  defaultOpen?: boolean;
}

const GRID_CLASS = "poster-grid";

/** Number of grid columns at the current viewport, matching the poster-grid breakpoints. */
const useGridRowSize = () => {
  const getRowSize = () => {
    if (typeof window === "undefined") return 6;
    if (window.innerWidth >= 1280) return 6; // xl
    if (window.innerWidth >= 1024) return 5; // lg
    if (window.innerWidth >= 768) return 4; // md
    if (window.innerWidth >= 640) return 3; // sm
    return 2; // base
  };
  const [rowSize, setRowSize] = useState(getRowSize);
  useEffect(() => {
    const onResize = () => setRowSize(getRowSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return rowSize;
};

export function MovieGrid({ movies, title, showNotInterested = false, hideItemsWithoutPoster = false, collapsible = false, defaultOpen = false }: MovieGridProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rowSize = useGridRowSize();
  const displayMovies = useMemo(
    () => hideItemsWithoutPoster ? movies.filter((movie) => movie.poster_path) : movies,
    [movies, hideItemsWithoutPoster]
  );

  // Generate media IDs for watched status lookup
  const mediaIds = useMemo(() =>
    displayMovies.map(movie => {
      const isTV = !!movie.first_air_date;
      return isTV ? `${movie.id}tv` : String(movie.id);
    }),
    [displayMovies]
  );

  const { watchedMap } = useWatchedStatus(mediaIds);
  const { notInterestedMap } = useNotInterestedStatus(showNotInterested ? mediaIds : []);
  const { ratingsMap } = useOmdbRatings(displayMovies);
  const enrichedMovies = useMemo(
    () => enrichMoviesWithImdbRatings(displayMovies, ratingsMap),
    [displayMovies, ratingsMap]
  );

  if (displayMovies.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-muted/30 border border-border">
        <h2 className="text-xl font-semibold mb-2">
          {title ? title : "No movies found"}
        </h2>
        <p className="text-muted-foreground text-sm">
          Try searching for something else or check back later.
        </p>
      </div>
    );
  }

  const renderCard = (movie: Movie) => {
    const isTV = !!movie.first_air_date;
    const mediaId = isTV ? `${movie.id}tv` : String(movie.id);
    return (
      <MovieCard
        key={movie.id}
        movie={movie}
        isWatched={watchedMap[mediaId] ?? false}
        isNotInterested={notInterestedMap[mediaId] ?? false}
        showNotInterested={showNotInterested}
        hideIfNoPoster={hideItemsWithoutPoster}
      />
    );
  };

  if (!collapsible) {
    return (
      <div className="space-y-6">
        {title && (
          <div className="flex items-center gap-3">
            <h2 className="section-title">{title}</h2>
          </div>
        )}
        <div className={`${GRID_CLASS} animate-stagger`}>
          {enrichedMovies.map(renderCard)}
        </div>
      </div>
    );
  }

  // Collapsible: the first row stays visible even when collapsed, so the
  // section still previews content. The remaining rows mount inside
  // CollapsibleContent (`display: contents` keeps a single aligned grid).
  const firstRow = enrichedMovies.slice(0, rowSize);
  const remaining = enrichedMovies.slice(rowSize);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-6">
      {title && (
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={isOpen}
            >
              <h2 className="section-title">{title}</h2>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                  isOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>
      )}
      <div className={GRID_CLASS}>
        {firstRow.map(renderCard)}
        {remaining.length > 0 && (
          <CollapsibleContent forceMount className={cn(isOpen ? "contents" : "hidden")}>
            {remaining.map(renderCard)}
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

export default MovieGrid;
