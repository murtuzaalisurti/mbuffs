import express, { RequestHandler } from 'express'; // Import RequestHandler
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
} from '../controllers/collectionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireCollectionPermission } from '../middleware/collectionAuthMiddleware.js';
// Removed asyncHandler import

const router = express.Router();

// Cast middleware and controller functions to RequestHandler
router.get('/', requireAuth as RequestHandler, getUserCollections as RequestHandler);
router.post('/', requireAuth as RequestHandler, createCollection as RequestHandler);

router.get(
    '/:collectionId',
    requireAuth as RequestHandler,                     
    requireCollectionPermission('view') as RequestHandler, // Cast returned handler
    getCollectionById as RequestHandler         
);

router.put(
    '/:collectionId',
    requireAuth as RequestHandler,
    requireCollectionPermission('edit') as RequestHandler,
    updateCollection as RequestHandler
);

router.delete(
    '/:collectionId',
    requireAuth as RequestHandler,
    deleteCollection as RequestHandler
);

router.post(
    '/:collectionId/movies',
    requireAuth as RequestHandler,
    requireCollectionPermission('edit') as RequestHandler,
    addMovieToCollection as RequestHandler
);

router.delete(
    '/:collectionId/movies/:movieId',
    requireAuth as RequestHandler,
    requireCollectionPermission('edit') as RequestHandler,
    removeMovieFromCollection as RequestHandler
);

router.post(
    '/:collectionId/collaborators',
    requireAuth as RequestHandler,
    addCollaborator as RequestHandler
);

router.put(
    '/:collectionId/collaborators/:userId',
    requireAuth as RequestHandler,
    updateCollaboratorPermission as RequestHandler
);

router.delete(
    '/:collectionId/collaborators/:userId',
    requireAuth as RequestHandler,
    removeCollaborator as RequestHandler
);

export default router;
