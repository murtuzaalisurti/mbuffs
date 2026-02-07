import { Movie } from "@/lib/types";
import { getImageUrl } from "@/lib/api";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
}

export function MovieCard({ movie, onClick }: MovieCardProps) {
  const releaseYear = (movie.release_date || movie.first_air_date) 
    ? new Date(movie.first_air_date || movie.release_date).getFullYear() 
    : "Unknown";
  
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const navLink = `/media/${mediaType}/${movie.id}`;

  return (
    <Link to={navLink} className="group block card-glow rounded-xl transition-transform duration-300 group-hover:scale-[1.03]">
      <div 
        className="relative overflow-hidden rounded-xl bg-card border border-white/[0.06]"
        onClick={onClick}
      >
        {/* Poster Image */}
        <div className="aspect-[2/3] relative overflow-hidden">
          <img
            src={getImageUrl(movie.poster_path)}
            alt={movie.name || movie.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Gradient overlay — always visible at bottom, intensifies on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
          
          {/* Rating badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1">
            <Star className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" />
            <span className="text-xs font-semibold text-white">
              {movie.vote_average.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3.5">
          <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-white transition-colors">
            {movie.name || movie.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{releaseYear}</p>
        </div>
      </div>
    </Link>
  );
}

export default MovieCard;
