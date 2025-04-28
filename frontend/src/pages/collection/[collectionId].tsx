import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionDetails } from '@/lib/api';
import { CollectionDetails } from '@/lib/types';
import CollectionInfo from './CollectionInfo';

const CollectionDetailsPage = () => {
  const { collectionId } = useParams();
  const [collectionDetails, setCollectionDetails] = useState<CollectionDetails | null>(null);

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

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!collectionDetails) return null;

  return (
    <div>
      <CollectionInfo collection={collectionDetails.collection} />
      {/* ... rest of your component ... */}
    </div>
  );
};

export default CollectionDetailsPage;