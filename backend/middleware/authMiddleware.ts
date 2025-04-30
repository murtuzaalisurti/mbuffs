import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import { sql } from "../lib/db.js"; // Import sql for fetching user details if needed
import { DatabaseUserAttributes } from "../lib/types.js"; // Import user type

// Extend Express Request type to include userId
declare global {
    namespace Express {
        interface Request {
            userId?: string | null; // Optional userId
            user?: DatabaseUserAttributes | null; // Optional user object
        }
    }
}

// Middleware to verify JWT and optionally attach user data to request
export const deserializeUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    req.userId = null; // Initialize userId
    req.user = null; // Initialize user

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
                req.userId = decoded.userId;
                // Optionally fetch user details here if needed frequently
                // try {
                //     const result = await sql<DatabaseUserAttributes[]>\`
                //         SELECT id, email, username, avatar_url FROM "user" WHERE id = \${req.userId}
                //     \`;
                //     if (result.length > 0) {
                //         req.user = result[0];
                //     }
                // } catch (dbError) {
                //     console.error("Failed to fetch user details in middleware:", dbError);
                //     // Decide if this should prevent request processing
                // }
            } else {
                 console.log("JWT verification failed or token expired");
            }
        }
    } else {
        // console.log("No Authorization header found");
    }

    return next();
};

// Middleware to protect routes - requires a valid JWT with userId
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
         console.log("Access denied for request:", req.path, " No userId found.");
        return res.status(401).json({ message: "Unauthorized: Authentication required" });
    }
    // User is authenticated (JWT is valid and contains userId), proceed
    next();
};
