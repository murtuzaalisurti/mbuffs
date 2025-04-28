import { CollectionDetails, CollectionSummary } from './types';
import { getToken } from './auth';

export const fetchCollectionDetails = async (collectionId: string): Promise<CollectionDetails> => {
    const token = getToken();
    const response = await fetch(`/api/collections/${collectionId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Could not fetch collection');
    }
    return data;
};
export const fetchPublicCollectionDetails = async (shareableId: string): Promise<CollectionDetails> => {
    const response = await fetch(`/api/collections/share/${shareableId}`);
    
    if (response.status === 404) {
      return null as unknown as CollectionDetails;
    }
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Could not fetch collection');
    }
    
    const data = await response.json();
    return data;
};
export const fetchCollections = async (): Promise<{collections: CollectionSummary[]}> => {
    const token = getToken();
    const response = await fetch('/api/collections', {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Could not fetch collections');
    }
    return data;
  };
export const searchMovies = async (query: string): Promise<any[]> => {
    const token = getToken();
    const response = await fetch(`/api/collections/movies/search?query=${query}`,{
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Could not search movies');
    }
    return data;
};

export const addMovieToCollection = async (collectionId: string, movieId: number): Promise<any> => {
    const token = getToken();
    const response = await fetch(`/api/collections/${collectionId}/movies`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ movieId }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Could not add movie to collection');
    }
    return data;
};

export const removeMovieFromCollection = async (collectionId: string, movieId: number): Promise<void> => {
    const token = getToken();
    const response = await fetch(`/api/collections/${collectionId}/movies/${movieId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Could not remove movie from collection');
    }
};