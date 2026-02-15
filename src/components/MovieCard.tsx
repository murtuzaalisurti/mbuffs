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
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-100 transition-opacity duration-300" />


          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end z-10">
            <h3 className="font-semibold text-xs sm:text-sm leading-tight text-white line-clamp-2 drop-shadow-md shadow-black">
              {movie.name || movie.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <p className="text-[10px] text-white/70 font-medium">{releaseYear}</p>
              <span className="text-[10px] text-white/40">•</span>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-400" fill="currentColor" />
                <span className="text-[10px] font-medium text-white/90">
                  {movie.vote_average.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default MovieCard;
