
import React from 'react';
import { CollectionSummary } from '@/lib/types';

interface CollectionInfoProps {
  collection: CollectionSummary;
}

const CollectionInfo: React.FC<CollectionInfoProps> = ({ collection }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h1 className="text-2xl font-bold text-white">{collection.name}</h1>
      {collection.description && (
        <p className="text-gray-300 mt-2">{collection.description}</p>
      )}
      <div className="mt-2 text-sm text-gray-400">
        <span>Created by: {collection.owner_username || 'Unknown'}</span>
      </div>
    </div>
  );
};

export default CollectionInfo;
