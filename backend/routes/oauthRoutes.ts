import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import { toNodeHandler } from "better-auth/node";
import { auth } from '../lib/auth.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sql } from '../lib/db.js';

const router = express.Router();

// Custom /me endpoint to get current user with additional fields
// This must be defined BEFORE the catch-all handler
const getCurrentUser: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    try {
        // Fetch user details including custom fields
        const result = await sql`
            SELECT id, email, name, image, 
                   recommendations_enabled as "recommendationsEnabled", 
                   recommendations_collection_id as "recommendationsCollectionId"
            FROM "user" 
            WHERE id = ${req.userId}
        `;
        
        if (result.length === 0) {
            console.warn(`User ID ${req.userId} found in session but not in database.`);
            res.status(404).json({ message: "User not found" });
            return;
        }

        const user = result[0];
        res.status(200).json({ user });
    } catch (error) {
        console.error("Error fetching current user:", error);
        next(error);
    }
};

router.get('/me', requireAuth as RequestHandler, getCurrentUser);

// Better Auth handles all other auth routes at /api/auth/*
// This includes: /sign-in/social, /callback/google, /sign-out, /session, etc.
router.all("/*splat", toNodeHandler(auth));

export default router;
