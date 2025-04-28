import React, { useEffect, useState, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollectionDetails, searchMovies, addMovieToCollection, removeMovieFromCollection } from '@/lib/api';
import { CollectionDetails, CollectionMovieEntry } from '@/lib/types';
import CollectionInfo from '@/components/collection/CollectionInfo';

const CollectionDetailsPage = () => {
  const { collectionId } = useParams();
  const [collectionDetails, setCollectionDetails] = useState<CollectionDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);


  const { isLoading, error, data } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => fetchCollectionDetails(collectionId!),
    enabled: !!collectionId,
  });

  useEffect(() => {
    if (data) {
      setCollectionDetails(data);
    }
  }, [data]);

  const { data: searchData, isLoading: isSearchLoading } = useQuery({
    queryKey: ['searchMovies', searchQuery],
    queryFn: () => searchMovies(searchQuery),
    enabled: !!searchQuery,
  });

  const queryClient = useQueryClient();
  const addMovieMutation = useMutation({
    mutationFn: (movieId: number) => addMovieToCollection(collectionId!, movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
      setSelectedMovie(null);
    },
  });

  const removeMovieMutation = useMutation({
    mutationFn: (movieId: number) => removeMovieFromCollection(collectionId!, movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });


  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setSelectedMovie(null);
    if (searchData) {
        setSearchResults(searchData)
    }
  };

  const handleMovieSelect = (movie: any) => {
    setSelectedMovie(movie);
  };

  const handleAddMovie = () => {
    if (selectedMovie) {
      addMovieMutation.mutate(selectedMovie.id);
    }
  };

  const handleRemoveMovie = (movieId: number) => {
    removeMovieMutation.mutate(movieId);
  }

  if (isLoading) return <div className='text-white'>Loading...</div>;
  if (error) return <div className='text-white'>Error: {error.message}</div>;

  if (!collectionDetails) return <div className='text-white'>Collection not found</div>;

  return (
    <div className='text-white p-4'>
      <CollectionInfo collection={collectionDetails.collection} />
        <div className="mt-4">
        <input
          type="text"
          placeholder="Search for movies..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="p-2 border border-gray-300 rounded text-black"
        />
        {isSearchLoading && <div className='mt-2'>Searching...</div>}
        {searchQuery && searchResults && searchResults.length > 0 && (
            <ul className="mt-2">
              {searchResults.map((movie) => (
                <li key={movie.id} onClick={() => handleMovieSelect(movie)} className="cursor-pointer hover:bg-gray-700 p-2 rounded">
                  {movie.title}
                </li>
              ))}
            </ul>
          )}
        {selectedMovie && (
          <div className="mt-2">
            <p>Selected: {selectedMovie.title}</p>
            <button
              onClick={handleAddMovie}
              disabled={addMovieMutation.isLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              {addMovieMutation.isLoading ? 'Adding...' : 'Add to Collection'}
            </button>
          </div>
        )}
      </div>
        <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">Movies in Collection</h2>
          <ul>
             {collectionDetails.movies.map((movie) => (
              <li key={movie.movie_id} className="p-2 border-b border-gray-700 flex justify-between items-center">
                <div>
                  Movie ID: {movie.movie_id} - Added by: {movie.added_by_username}
                </div>
                 <button 
                    onClick={() => handleRemoveMovie(movie.movie_id)}
                    disabled={removeMovieMutation.isLoading}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm" >Remove</button>
              </li>
            ))}
        </ul>
      </div>


    </div>
  );
};

export default CollectionDetailsPage;