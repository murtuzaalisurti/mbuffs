import { ReactNode, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { Rail } from "./Rail";
import { useWatchedStatus } from "@/hooks/useWatchedStatus";
import { useNotInterestedStatus } from "@/hooks/useNotInterestedStatus";
import { useOmdbRatings, enrichMoviesWithImdbRatings } from "@/hooks/useOmdbRatings";

interface MediaRailProps {
  title: ReactNode;
  subtitle?: ReactNode;
  movies: Movie[];
  /** How many titles the rail shows before "See all" */
  limit?: number;
  showNotInterested?: boolean;
}

const RAIL_POSTER_SIZES = "(min-width: 768px) 180px, (min-width: 640px) 160px, 140px";
const EXPANDED_GRID_CLASS = "grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5";

/**
 * A rail of media cards that can open into a full grid in place, for lists
 * (trending, now playing) that have no page of their own.
 */
export function MediaRail({ title, subtitle, movies, limit = 20, showNotInterested = false }: MediaRailProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleMovies = useMemo(
    () => (expanded ? movies : movies.slice(0, limit)).filter((movie) => movie.poster_path),
    [movies, limit, expanded]
  );

  const mediaIds = useMemo(
    () => visibleMovies.map((movie) => (movie.first_air_date ? `${movie.id}tv` : String(movie.id))),
    [visibleMovies]
  );
  const { watchedMap } = useWatchedStatus(mediaIds);
  const { notInterestedMap } = useNotInterestedStatus(showNotInterested ? mediaIds : []);
  const { ratingsMap } = useOmdbRatings(visibleMovies);
  const enrichedMovies = useMemo(
    () => enrichMoviesWithImdbRatings(visibleMovies, ratingsMap),
    [visibleMovies, ratingsMap]
  );

  if (enrichedMovies.length === 0) return null;

  const renderCard = (movie: Movie, imageSizes?: string) => {
    const mediaId = movie.first_air_date ? `${movie.id}tv` : String(movie.id);
    return (
      <MovieCard
        key={movie.id}
        movie={movie}
        isWatched={watchedMap[mediaId] ?? false}
        isNotInterested={notInterestedMap[mediaId] ?? false}
        showNotInterested={showNotInterested}
        imageSizes={imageSizes}
      />
    );
  };

  const toggle = movies.length > limit && (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>{expanded ? "Show less" : "See all"}</span>
      <ChevronRight
        className={`h-4 w-4 transition-transform duration-(--dur-ui) ease-(--ease-out) ${expanded ? "-rotate-90" : "group-hover:translate-x-0.5"}`}
      />
    </button>
  );

  if (expanded) {
    return (
      <section className="space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight lowercase">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="shrink-0">{toggle}</div>
        </header>
        <div className={`${EXPANDED_GRID_CLASS} animate-fade-in-up`}>
          {enrichedMovies.map((movie) => renderCard(movie))}
        </div>
      </section>
    );
  }

  return (
    <Rail title={title} subtitle={subtitle} action={toggle || undefined}>
      {enrichedMovies.map((movie) => renderCard(movie, RAIL_POSTER_SIZES))}
    </Rail>
  );
}

export default MediaRail;
