
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MovieGrid } from "@/components/MovieGrid";
import { Collection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Share, Heart } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const CollectionPage = () => {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch the collection from your API
    const fetchCollection = async () => {
      setLoading(true);
      
      // Simulate API call with mock data
      setTimeout(() => {
        setCollection({
          id: id || "1",
          name: "My Favorite Sci-Fi Movies",
          description: "A collection of my all-time favorite science fiction films",
          isPublic: true,
          userId: "user123",
          createdAt: "2023-01-15T12:00:00Z",
          updatedAt: "2023-01-15T12:00:00Z",
          movies: [
            {
              id: 1,
              title: "Inception",
              poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
              release_date: "2010-07-16",
              vote_average: 8.4,
              overview: "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible."
            },
            {
              id: 3,
              title: "The Dark Knight",
              poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
              release_date: "2008-07-18",
              vote_average: 8.5,
              overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets."
            }
          ]
        });
        setLoading(false);
      }, 800);
    };

    fetchCollection();
  }, [id]);

  const handleShare = () => {
    // In a real app, this would generate a shareable link
    const shareUrl = window.location.href;
    
    // Check if the Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: collection?.name || "Movie Collection",
        text: collection?.description || "Check out this movie collection!",
        url: shareUrl
      });
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <>
      <Navbar isLoggedIn={false} />
      <main className="container py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : collection ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">{collection.name}</h1>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm">
                    <Heart className="h-4 w-4 mr-2" />
                    Like
                  </Button>
                </div>
              </div>
              
              <p className="text-muted-foreground">
                {collection.description}
              </p>
              
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Created: </span>
                  {new Date(collection.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Movies: </span>
                  {collection.movies.length}
                </div>
              </div>
            </div>
            
            <MovieGrid
              movies={collection.movies}
              title="Movies in this collection"
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Collection not found</h1>
            <p className="text-muted-foreground">
              The collection you're looking for doesn't exist or has been removed.
            </p>
          </div>
        )}
      </main>
    </>
  );
};

export default CollectionPage;
