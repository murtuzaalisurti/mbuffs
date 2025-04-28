import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicCollectionDetails } from '@/lib/api';
import { CollectionDetails } from '@/lib/types';
import CollectionInfo from '@/components/collection/CollectionInfo';

const PublicCollectionView = () => {
  const { shareableId } = useParams();
  const [collectionDetails, setCollectionDetails] = useState<CollectionDetails | null>(null);

  const { isLoading, error, data } = useQuery({
    queryKey: ['publicCollection', shareableId],
    queryFn: () => fetchPublicCollectionDetails(shareableId!),
    enabled: !!shareableId,
  });

  useEffect(() => {
    if (data) {
      setCollectionDetails(data);
    }
  }, [data]);

  if (isLoading) return <div>Loading...</div>;

  if (error) {
    return <div>Error: {error.message}</div>;
  }
    
  if (!collectionDetails) {
        return <div>Collection not found</div>
  }

  return (
    <div>
      <CollectionInfo collection={collectionDetails.collection} />
    </div>
  );
};

export default PublicCollectionView;
```
```typescript
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