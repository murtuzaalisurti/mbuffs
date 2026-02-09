import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { GenreRow } from "@/components/GenreRow";
import { fetchGenreListApi, fetchMoviesByGenreApi, fetchTvByGenreApi } from "@/lib/api";
import { Genre } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv } from "lucide-react";

// Popular genres to feature (subset for better UX)
const FEATURED_MOVIE_GENRE_IDS = [27, 53, 18, 878, 16, 28, 35, 10749]; // Horror, Thriller, Drama, Sci-Fi, Animation, Action, Comedy, Romance
const FEATURED_TV_GENRE_IDS = [9648, 18, 10765, 16, 10759, 35, 80, 10751]; // Mystery (closest to Horror/Thriller), Drama, Sci-Fi & Fantasy, Animation, Action & Adventure, Comedy, Crime, Family

const Categories = () => {
  return (
    <>
      <Navbar />
      <main className="container py-6 md:py-10">
        {/* Header */}
        <section className="mb-8 md:mb-12">
          <div className="relative">
            {/* Subtle gradient orb */}
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-10 left-40 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
                Browse by <span className="text-gradient">Category</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Discover movies and TV shows organized by genre.
              </p>
            </div>
          </div>
        </section>

        {/* Tabs for Movies / TV Shows */}
        <Tabs defaultValue="movie" className="w-full">
          <div className="flex justify-start overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="mb-8 bg-white/[0.04] border border-white/[0.08] w-max">
              <TabsTrigger value="movie" className="data-[state=active]:bg-white/[0.1] gap-2">
                <Film className="h-4 w-4" />
                Movies
              </TabsTrigger>
              <TabsTrigger value="tv" className="data-[state=active]:bg-white/[0.1] gap-2">
                <Tv className="h-4 w-4" />
                TV Shows
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="movie">
            <GenreRowsContent mediaType="movie" featuredGenreIds={FEATURED_MOVIE_GENRE_IDS} />
          </TabsContent>

          <TabsContent value="tv">
            <GenreRowsContent mediaType="tv" featuredGenreIds={FEATURED_TV_GENRE_IDS} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
};

// Component to render genre rows for a specific media type
function GenreRowsContent({ mediaType, featuredGenreIds }: { mediaType: 'movie' | 'tv'; featuredGenreIds: number[] }) {
  // Fetch genre list
  const { data: genreData, isLoading: isLoadingGenres } = useQuery({
    queryKey: ['genres', mediaType],
    queryFn: () => fetchGenreListApi(mediaType),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Filter to featured genres and maintain order
  const featuredGenres = featuredGenreIds
    .map(id => genreData?.genres.find(g => g.id === id))
    .filter((g): g is Genre => g !== undefined);

  if (isLoadingGenres) {
    return (
      <div className="space-y-12">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-32 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px]">
                  <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                  <Skeleton className="h-4 w-[75%] mt-3 rounded-md" />
                  <Skeleton className="h-3 w-[45%] mt-2 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {featuredGenres.map((genre) => (
        <GenreRowWithData
          key={`${mediaType}-${genre.id}`}
          genre={genre}
          mediaType={mediaType}
        />
      ))}
    </div>
  );
}

// Separate component to fetch data for each genre row
function GenreRowWithData({ genre, mediaType }: { genre: Genre; mediaType: 'movie' | 'tv' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['genre', mediaType, genre.id, 'preview'],
    queryFn: () => mediaType === 'movie' 
      ? fetchMoviesByGenreApi(genre.id, 1)
      : fetchTvByGenreApi(genre.id, 1),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  return (
    <GenreRow
      genre={genre}
      movies={data?.results || []}
      mediaType={mediaType}
      isLoading={isLoading}
      limit={10}
    />
  );
}

export default Categories;
