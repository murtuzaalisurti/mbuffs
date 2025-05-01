
import { Movie } from "@/lib/types";
import { getImageUrl } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
}

export function MovieCard({ movie, onClick }: MovieCardProps) {
  const releaseYear = (movie.release_date || movie.first_air_date) 
    ? new Date(movie.first_air_date || movie.release_date).getFullYear() 
    : "Unknown";

  return (
    <Card 
      className="overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        <img
          src={getImageUrl(movie.poster_path)}
          alt={movie.name || movie.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" fill="currentColor" />
            <span className="text-sm font-medium text-white">
              {movie.vote_average.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-bold line-clamp-1">{movie.name || movie.title}</h3>
        <p className="text-sm text-muted-foreground">{releaseYear}</p>
      </CardContent>
    </Card>
  );
}

export default MovieCard;
