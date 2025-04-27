import express from 'express';
import {
    getUserCollections,
    getCollectionById,
    createCollection,
    updateCollection,
    deleteCollection,
    addMovieToCollection,
    removeMovieFromCollection,
    addCollaborator,
    updateCollaboratorPermission,
    removeCollaborator
} from '../controllers/collectionController';
import { requireAuth } from '../middleware/authMiddleware'; // General authentication
import { requireCollectionPermission } from '../middleware/collectionAuthMiddleware'; // Collection-specific permissions

const router = express.Router();

// --- Collection Routes ---

// Get all collections for the current user (owned or collaborated on)
router.get('/', requireAuth, getUserCollections);

// Create a new collection
router.post('/', requireAuth, createCollection);

// Get details for a specific collection (requires at least 'view' permission)
router.get(
    '/:collectionId',
    requireAuth,
    requireCollectionPermission('view'),
    getCollectionById
);

// Update collection details (requires 'edit' permission)
router.put(
    '/:collectionId',
    requireAuth,
    requireCollectionPermission('edit'),
    updateCollection
);

// Delete a collection (implicitly requires ownership via controller logic)
router.delete(
    '/:collectionId',
    requireAuth,
    // No explicit permission middleware here, controller checks owner_id
    deleteCollection
);

// --- Movies within Collection Routes ---

// Add a movie to a collection (requires 'edit' permission)
router.post(
    '/:collectionId/movies',
    requireAuth,
    requireCollectionPermission('edit'),
    addMovieToCollection
);

// Remove a movie from a collection (requires 'edit' permission)
router.delete(
    '/:collectionId/movies/:movieId',
    requireAuth,
    requireCollectionPermission('edit'),
    removeMovieFromCollection
);

// --- Collaborator Routes ---

// Add a collaborator (requires ownership via controller logic)
router.post(
    '/:collectionId/collaborators',
    requireAuth,
    // requireCollectionPermission('edit'), // Or owner only? Controller logic checks owner.
    addCollaborator
);

// Update collaborator permission (requires ownership via controller logic)
router.put(
    '/:collectionId/collaborators/:userId',
    requireAuth,
    // requireCollectionPermission('edit'), // Or owner only? Controller logic checks owner.
    updateCollaboratorPermission
);

// Remove a collaborator (requires ownership via controller logic)
router.delete(
    '/:collectionId/collaborators/:userId',
    requireAuth,
    // requireCollectionPermission('edit'), // Or owner only? Controller logic checks owner.
    removeCollaborator
);


export default router;
