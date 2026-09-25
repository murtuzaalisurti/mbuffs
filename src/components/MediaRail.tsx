import { ReactNode, useMemo } from "react";
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
  showNotInterested?: boolean;
  /** Title toggles between one row and a multi-row grid (both scroll sideways) */
  expandable?: boolean;
}

const RAIL_POSTER_SIZES = "(min-width: 768px) 180px, (min-width: 640px) 160px, 140px";

/** A scrollable row of media cards with watched / not-interested state and IMDb ratings. */
export function MediaRail({ title, subtitle, movies, showNotInterested = false, expandable = false }: MediaRailProps) {
  const visibleMovies = useMemo(() => movies.filter((movie) => movie.poster_path), [movies]);

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

  return (
    <Rail title={title} subtitle={subtitle} expandable={expandable}>
      {enrichedMovies.map((movie) => {
        const mediaId = movie.first_air_date ? `${movie.id}tv` : String(movie.id);
        return (
          <MovieCard
            key={movie.id}
            movie={movie}
            isWatched={watchedMap[mediaId] ?? false}
            isNotInterested={notInterestedMap[mediaId] ?? false}
            showNotInterested={showNotInterested}
            imageSizes={RAIL_POSTER_SIZES}
          />
        );
      })}
    </Rail>
  );
}

export default MediaRail;
