import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { MovieGrid } from "@/components/MovieGrid";
import { fetchPopularMoviesApi } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Movie } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { Button } from '@/components/ui/button';

const POPULAR_MOVIES_QUERY_KEY = ['movies', 'popular'];

// Define the expected shape of the API response if it includes pagination info
interface PopularMoviesResponse {
  results: Movie[];
  page: number;
  total_pages: number;
  total_results: number;
}


const Index = () => {
  const {
    data, // Data is now an object with pages and pageParams
    error,
    fetchNextPage,
    hasNextPage,
    isFetching, // General fetching state (initial load)
    isFetchingNextPage, // Fetching state for subsequent pages
    isLoading, // Initial loading state
    isError,
  } = useInfiniteQuery<PopularMoviesResponse, Error>({ // Use useInfiniteQuery and specify response type
    queryKey: POPULAR_MOVIES_QUERY_KEY,
    // Assuming fetchPopularMoviesApi accepts a page number
    // You might need to adjust fetchPopularMoviesApi accordingly
    queryFn: ({ pageParam = 1 }) => fetchPopularMoviesApi(pageParam as number),
    initialPageParam: 1, // Start fetching from page 1
    getNextPageParam: (lastPage) => {
      // Check if there's a next page based on the API response
      if (lastPage.page < lastPage.total_pages) {
        return lastPage.page + 1;
      }
      return undefined; // No more pages
    },
    staleTime: 1000 * 60 * 60, // Cache popular movies for 1 hour
  });

  // Flatten the pages array into a single array of movies
  const popularMovies = data?.pages.flatMap(page => page.results) || [];

  return (
    <>
      <Navbar />
      <main className="container py-8">
        <h1 className="text-3xl font-bold mb-6">A place for your movie buffs.</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Watch, Add, Share.
        </p>

        {isLoading ? ( // Show skeleton only on initial load
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
          <>
            <MovieGrid
              movies={popularMovies} // Pass the flattened array
              title="Recent Content"
            />
            {/* Add Load More Button */}
            <div className="text-center mt-8">
              <Button
                onClick={() => fetchNextPage()}
                disabled={!hasNextPage || isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? 'Loading more...'
                  : hasNextPage
                  ? 'Load More'
                  : 'Nothing more to load'}
              </Button>
            </div>
            {/* Optional: Show a loading indicator while fetching next page */}
            {isFetching && !isFetchingNextPage && !isLoading && (
              <div className="text-center mt-4">Fetching...</div>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default Index;
