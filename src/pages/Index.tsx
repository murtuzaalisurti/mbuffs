
import { useEffect, useState } from "react";
import { MovieGrid } from "@/components/MovieGrid";
import { Movie } from "@/lib/types";
import { fetchPopularMovies } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

const Index = () => {
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        const movies = await fetchPopularMovies();
        setPopularMovies(movies);
      } catch (error) {
        console.error("Failed to load movies:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  return (
    <>
      <Navbar isLoggedIn={false} />
      <main className="container py-8">
        <h1 className="text-3xl font-bold mb-6">FlickShareClub</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Discover, collect, and share your favorite movies with friends.
        </p>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MovieGrid
            movies={popularMovies}
            title="Popular Movies"
          />
        )}
      </main>
    </>
  );
};

export default Index;
