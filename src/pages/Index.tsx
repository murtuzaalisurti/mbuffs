import { useQuery } from '@tanstack/react-query';
import { MovieGrid } from "@/components/MovieGrid";
import { fetchPopularMoviesApi } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Movie } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

const POPULAR_MOVIES_QUERY_KEY = ['movies', 'popular'];

const Index = () => {
  const { 
    data: popularMovies,
    isLoading,
    isError,
    error 
  } = useQuery<Movie[], Error>({ // Specify types
    queryKey: POPULAR_MOVIES_QUERY_KEY,
    queryFn: fetchPopularMoviesApi,
    staleTime: 1000 * 60 * 60, // Cache popular movies for 1 hour
  });

  return (
    <>
      <Navbar /> {/* Navbar now handles its own auth state */}
      <main className="container py-8">
        <h1 className="text-3xl font-bold mb-6">A place for your movie buffs.</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Watch, Add, Share.
        </p>
        
        {isLoading ? (
          // Skeleton loading state
          <div>
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="aspect-[2/3] w-full rounded-md" />
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="h-4 w-[50%]" />
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
           <div className="text-red-500 text-center py-12">
             <p>Error loading popular movies: {error.message}</p>
             <p>Please check your TMDB API key (VITE_TMDB_API_KEY) and internet connection.</p>
           </div>
        ) : (
          <MovieGrid
            movies={popularMovies || []}
            title="Popular Movies"
          />
        )}
      </main>
    </>
  );
};

export default Index;
