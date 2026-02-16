import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type User } from "../lib/auth.js";

// Extend Express Request type
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            userId?: string | null;
            user?: User | null;
            session?: typeof auth.$Infer.Session.session | null;
        }
    }
}

// Middleware to get session and attach user info to request
export const deserializeUser = async (req: Request, res: Response, next: NextFunction) => {
    req.userId = null;
    req.user = null;
    req.session = null;

    console.log(`[deserializeUser] Path: ${req.path}`);
    res.locals.path = req.path;

    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (session) {
            req.userId = session.user.id;
            req.user = session.user;
            req.session = session.session;
            console.log(`[deserializeUser] SUCCESS: userId set to ${req.userId}`);
        } else {
            console.log("[deserializeUser] No valid session found.");
        }
    } catch (error) {
        console.error("[deserializeUser] Error getting session:", error);
    }

    console.log(`[deserializeUser] Final req.userId before next(): ${req.userId}`);
    return next();
};

// Middleware to protect routes - requires a valid session
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (res.locals.path === "/api/content") {
        console.log("[requireAuth] Skipping auth check for content path.");
        return next();
    }

    console.log(`[requireAuth] Checking auth for path: ${req.path}. Found userId: ${req.userId}`);
    if (!req.userId) {
        console.log(`[requireAuth] Access denied for request: ${req.path}. No userId found.`);
        return res.status(401).json({ message: "Unauthorized: Authentication required" });
    }
    
    console.log(`[requireAuth] Access granted for path: ${req.path}.`);
    next();
};
