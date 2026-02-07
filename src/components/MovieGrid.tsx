import { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { useNavigate } from "react-router-dom";

interface MovieGridProps {
  movies: Movie[];
  title?: string;
}

export function MovieGrid({ movies, title }: MovieGridProps) {
  const navigate = useNavigate();

  if (movies.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h2 className="text-xl font-semibold mb-2">
          {title ? title : "No movies found"}
        </h2>
        <p className="text-muted-foreground text-sm">
          Try searching for something else or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full bg-primary" />
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
          />
        ))}
      </div>
    </div>
  );
}

export default MovieGrid;
