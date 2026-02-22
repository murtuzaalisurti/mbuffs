import { Movie } from "@/lib/types";
import { getImageUrl, toggleWatchedStatusApi } from "@/lib/api";
import { Star, Eye, EyeOff, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState, ReactNode, useEffect, useRef } from "react";

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
  isWatched?: boolean;
  /** Additional menu items to render after the watched option */
  additionalMenuItems?: ReactNode;
}

export function MovieCard({ movie, onClick, isWatched = false, additionalMenuItems }: MovieCardProps) {
  const releaseYear = (movie.release_date || movie.first_air_date) 
    ? new Date(movie.first_air_date || movie.release_date).getFullYear() 
    : "Unknown";
  
  const mediaType = movie.first_air_date ? "tv" : "movie";
  const navLink = `/media/${mediaType}/${movie.id}`;
  const mediaId = mediaType === "tv" ? `${movie.id}tv` : String(movie.id);
  
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Track the displayed watched state locally for optimistic updates
  const [localWatched, setLocalWatched] = useState(isWatched);
  const isPendingRef = useRef(false);
  
  // Sync with prop when not in a pending state
  useEffect(() => {
    if (!isPendingRef.current) {
      setLocalWatched(isWatched);
    }
  }, [isWatched]);

  const toggleWatchedMutation = useMutation({
    mutationFn: () => toggleWatchedStatusApi(mediaId),
    onMutate: async () => {
      isPendingRef.current = true;
      const newValue = !localWatched;
      setLocalWatched(newValue);
      
      await queryClient.cancelQueries({ queryKey: ['watched', mediaId] });
      await queryClient.cancelQueries({ queryKey: ['watchedBatch'] });
      
      return { previousWatched: localWatched };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watched'] });
      queryClient.invalidateQueries({ queryKey: ['watchedBatch'] });
    },
    onSettled: () => {
      isPendingRef.current = false;
    },
    onError: (_error: Error, _, context) => {
      if (context) {
        setLocalWatched(context.previousWatched);
      }
      toast.error('Failed to update watched status');
    },
  });

  const handleWatchedClick = () => {
    if (!isLoggedIn) {
      toast.error('Please sign in to mark as watched');
      return;
    }
    toggleWatchedMutation.mutate();
  };

  return (
    <Link to={navLink} className="group block card-glow rounded-xl transition-transform duration-300 group-hover:scale-[1.03]">
      <div 
        className="relative overflow-hidden rounded-xl bg-card border border-white/6"
        onClick={onClick}
      >
        {/* Poster Image */}
        <div className="aspect-2/3 relative overflow-hidden">
          <img
            src={getImageUrl(movie.poster_path)}
            alt={movie.name || movie.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Gradient overlay — always visible at bottom, intensifies on hover */}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-100 transition-opacity duration-300" />

          {/* Three-dot Menu */}
          {isLoggedIn && (
            <div className="absolute top-2 right-2 z-20">
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-full bg-black/50 border-0 hover:bg-black/70 transition-opacity ${
                      menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <MoreVertical className="h-4 w-4 text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleWatchedClick();
                    }}
                  >
                    {localWatched ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    {localWatched ? 'Unwatch' : 'Watched'}
                  </DropdownMenuItem>
                  {additionalMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

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
