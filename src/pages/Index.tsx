import { useInfiniteQuery } from '@tanstack/react-query';
import { MovieGrid } from "@/components/MovieGrid";
import { fetchPopularMoviesApi } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Movie } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

const POPULAR_MOVIES_QUERY_KEY = ['movies', 'popular'];

interface PopularMoviesResponse {
  results: Movie[];
  page: number;
  total_pages: number;
  total_results: number;
}

const Index = () => {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<PopularMoviesResponse, Error>({
    queryKey: POPULAR_MOVIES_QUERY_KEY,
    queryFn: ({ pageParam = 1 }) => fetchPopularMoviesApi(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.total_pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 60,
  });

  const popularMovies = data?.pages.flatMap(page => page.results) || [];

  return (
    <>
      <Navbar />
      <main className="container py-6 md:py-10">
        {/* Hero Section */}
        <section className="relative mb-12 md:mb-16">
          {/* Subtle gradient orb behind the text */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-10 left-40 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
              A place for your
              <br />
              <span className="text-gradient">movie buffs.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md">
              Watch, Add, Share.
            </p>
          </div>
        </section>

        {/* Content Section */}
        {isLoading ? (
          <div>
            <Skeleton className="h-7 w-44 mb-8 rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="space-y-3">
                  <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                  <Skeleton className="h-4 w-[75%] rounded-md" />
                  <Skeleton className="h-3 w-[45%] rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
           <div className="text-red-500 text-center py-16 rounded-2xl bg-red-500/[0.05] border border-red-500/10">
             <p className="font-medium">Error loading popular movies: {error.message}</p>
             <p className="text-sm text-red-400/70 mt-1">Please check your TMDB API key and internet connection.</p>
           </div>
        ) : (
          <div>
            <MovieGrid
              movies={popularMovies}
              title="Recent Content"
            />
            
            {/* Load More */}
            <div className="flex justify-center mt-10 md:mt-12">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fetchNextPage()}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-xl border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all px-8 gap-2"
              >
                {isFetchingNextPage ? (
                  'Loading...'
                ) : hasNextPage ? (
                  <>
                    Load More
                    <ChevronDown className="h-4 w-4" />
                  </>
                ) : (
                  "You've seen it all"
                )}
              </Button>
            </div>
            
            {isFetching && !isFetchingNextPage && !isLoading && (
              <div className="text-center mt-4 text-muted-foreground text-sm">Refreshing...</div>
            )}
          </div>
        )}
      </main>
    </>
  );
};

export default Index;
