import { useParams, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { MovieCard } from "@/components/MovieCard";
import { fetchGenreListApi, fetchMoviesByGenreApi, fetchTvByGenreApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";

const CategoryDetail = () => {
  const { mediaType, genreId } = useParams<{ mediaType: 'movie' | 'tv'; genreId: string }>();
  const genreIdNum = parseInt(genreId || '0', 10);

  // Fetch genre name
  const { data: genreData } = useQuery({
    queryKey: ['genres', mediaType],
    queryFn: () => fetchGenreListApi(mediaType as 'movie' | 'tv'),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    enabled: !!mediaType,
  });

  const genreName = genreData?.genres.find(g => g.id === genreIdNum)?.name || 'Category';

  // Infinite query for paginated results
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['genre', mediaType, genreIdNum, 'all'],
    queryFn: ({ pageParam = 1 }) => 
      mediaType === 'movie' 
        ? fetchMoviesByGenreApi(genreIdNum, pageParam)
        : fetchTvByGenreApi(genreIdNum, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.total_pages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!mediaType && !!genreIdNum,
  });

  const allMovies = data?.pages.flatMap(page => page.results) || [];
  const totalResults = data?.pages[0]?.total_results || 0;

  return (
    <>
      <Navbar />
      <main className="container py-6 md:py-10">
        {/* Header */}
        <section className="mb-8">
          <Link
            to="/categories"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Categories
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-1 rounded-full bg-primary" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {genreName}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {mediaType === 'movie' ? 'Movies' : 'TV Shows'} 
            {totalResults > 0 && ` (${totalResults.toLocaleString()} results)`}
          </p>
        </section>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {Array.from({ length: 18 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-2/3 w-full rounded-xl" />
                <Skeleton className="h-4 w-[75%] rounded-md" />
                <Skeleton className="h-3 w-[45%] rounded-md" />
              </div>
            ))}
          </div>
        ) : allMovies.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {allMovies.map((movie, index) => (
                <MovieCard key={`${movie.id}-${index}`} movie={movie} />
              ))}
            </div>

            {/* Load more button */}
            <div className="flex justify-center py-8">
              {hasNextPage && (
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              )}
              {!hasNextPage && allMovies.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  You've seen all {totalResults.toLocaleString()} results
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No results found for this category.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/categories">Browse other categories</Link>
            </Button>
          </div>
        )}
      </main>
    </>
  );
};

export default CategoryDetail;
