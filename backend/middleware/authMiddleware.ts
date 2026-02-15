import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import { DatabaseUserAttributes } from "../lib/types.js";

// Extend Express Request type
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            userId?: string | null;
            user?: DatabaseUserAttributes | null; // Kept for potential future use if needed
        }
    }
}

// Middleware to verify JWT and attach userId to request
export const deserializeUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    req.userId = null; // Initialize userId
    // req.user = null; // Initialize user

    console.log(`[deserializeUser] Path: ${req.path}`); // Log path
    console.log(`[deserializeUser] Authorization Header: ${authHeader}`); // Log header

    res.locals.path = req.path; // Store path in locals for potential use in other middleware

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        console.log(`[deserializeUser] Extracted Token: ${token ? 'present' : 'missing'}`); // Log token presence

        if (token) {
            const decoded = verifyToken(token);
            console.log(`[deserializeUser] Decoded Token Payload:`, decoded); // Log decoded payload

            if (decoded && decoded.userId) {
                req.userId = decoded.userId;
                console.log(`[deserializeUser] SUCCESS: userId set to ${req.userId}`);
                // Optionally fetch user details here if needed frequently
                // try {
                //     const result = await sql<DatabaseUserAttributes>`SELECT id, email, username, avatar_url FROM "user" WHERE id = ${req.userId}`;
                //     if (result.rowCount > 0) {
                //         req.user = result.rows[0];
                //     }
                // } catch (dbError) {
                //     console.error("[deserializeUser] Failed to fetch user details:", dbError);
                // }
            } else {
                 console.log("[deserializeUser] FAILURE: JWT verification failed, token expired, or userId missing in payload.");
            }
        } else {
             console.log("[deserializeUser] FAILURE: Token was not found after 'Bearer ' prefix.");
        }
    } else {
         console.log("[deserializeUser] FAILURE: No suitable Authorization header found.");
    }

    console.log(`[deserializeUser] Final req.userId before next(): ${req.userId}`); // Log final userId
    return next();
};

// Middleware to protect routes - requires a valid JWT with userId
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (res.locals.path === "/api/content") {
        console.log("[requireAuth] Skipping auth check for content path.");
        return next();
    }

    console.log(`[requireAuth] Checking auth for path: ${req.path}. Found userId: ${req.userId}`); // Log entry
    if (!req.userId) {
         console.log(`[requireAuth] Access denied for request: ${req.path}. No userId found.`);
        return res.status(401).json({ message: "Unauthorized: Authentication required" });
    }
    // User is authenticated (JWT is valid and contains userId), proceed
    console.log(`[requireAuth] Access granted for path: ${req.path}.`);
    next();
};
