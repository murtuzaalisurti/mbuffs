import React, { useState } from 'react';
import { CollectionSummary } from '@/lib/types';
import { useCopyToClipboard } from 'usehooks-ts';

interface CollectionInfoProps {
  collection: CollectionSummary;
}

const CollectionInfo: React.FC<CollectionInfoProps> = ({ collection }) => {
  const [copied, setCopied] = useState(false);
  const [, copyToClipboard] = useCopyToClipboard();
  const shareableLink = `${window.location.origin}/collection/${collection.shareable_id}`;

  const handleCopyClick = () => {
    copyToClipboard(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">{collection.name}</h1>
      <p className="mt-2">{collection.description}</p>
      {collection.shareable_id && (
        <div className="mt-4">
          <p className="text-gray-600">
            Shareable Link:{' '}
            <a href={shareableLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {shareableLink}
            </a>
          </p>
          <button
            onClick={handleCopyClick}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CollectionInfo;