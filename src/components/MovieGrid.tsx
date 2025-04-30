
import { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { useNavigate } from "react-router-dom";

interface MovieGridProps {
  movies: Movie[];
  title?: string;
}

export function MovieGrid({ movies, title }: MovieGridProps) {
  const navigate = useNavigate();

  const handleMovieClick = (movieId: number) => {
    navigate(`/movie/${movieId}`);
  };

  if (movies.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">
          {title ? title : "No movies found"}
        </h2>
        <p className="text-muted-foreground">
          Try searching for something else or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            // onClick={() => handleMovieClick(movie.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default MovieGrid;
