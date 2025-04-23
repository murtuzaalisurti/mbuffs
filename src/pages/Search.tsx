
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MovieGrid } from "@/components/MovieGrid";
import { Movie } from "@/lib/types";
import { searchMovies } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true);
      
      try {
        if (query) {
          const results = await searchMovies(query);
          setMovies(results.results);
        } else {
          setMovies([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query]);

  return (
    <>
      <Navbar isLoggedIn={false} />
      <main className="container py-8">
        <h1 className="text-3xl font-bold mb-2">Search Results</h1>
        {query && (
          <p className="text-muted-foreground mb-8">
            Showing results for "{query}"
          </p>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MovieGrid movies={movies} />
        )}
      </main>
    </>
  );
};

export default Search;
