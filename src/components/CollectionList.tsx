
import { Collection } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Film } from "lucide-react";

interface CollectionListProps {
  collections: Collection[];
  title?: string;
}

export function CollectionList({ collections, title }: CollectionListProps) {
  if (collections.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">
          {title ? title : "No collections found"}
        </h2>
        <p className="text-muted-foreground">
          Create your first movie collection to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Link to={`/collection/${collection.id}`} key={collection.id}>
            <Card className="h-full transition-all hover:border-primary">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{collection.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Film size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {collection.movies.length}
                    </span>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {collection.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {collection.movies.length > 0 ? (
                  <div className="flex gap-1 overflow-hidden">
                    {collection.movies.slice(0, 4).map((movie) => (
                      <img
                        key={movie.id}
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={movie.title}
                        className="h-24 w-16 object-cover rounded"
                      />
                    ))}
                    {collection.movies.length > 4 && (
                      <div className="h-24 w-16 flex items-center justify-center rounded bg-muted">
                        <span className="text-sm font-medium">
                          +{collection.movies.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No movies added yet
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default CollectionList;
