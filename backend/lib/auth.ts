import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import * as schema from "../db/schema.js";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
}

// Create drizzle instance for better-auth
const sql = neon(databaseUrl);
const db = drizzle(sql);

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        },
    }),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5001",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:8080"],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day (refresh session if older than 1 day)
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache
        },
    },
    advanced: {
        // Cross-origin cookie setup for separate frontend/backend domains (PWA support)
        // sameSite:"none" + secure:true is required for cross-origin fetch()
        // requests to send cookies (used by useSession() in the PWA).
        // Without this, cookies only travel on top-level navigations (the OAuth
        // redirect), so the session appears valid right after login but is gone
        // when the PWA is closed and reopened.
        // In development (HTTP) we fall back to "lax" because "none" requires HTTPS.
        defaultCookieAttributes: {
            sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
            secure: process.env.NODE_ENV === "production",
            // Explicit maxAge prevents iOS from treating these as session-only cookies
            // that get wiped when it kills the PWA's WKWebView process.
            maxAge: 60 * 60 * 24 * 7, // 7 days — matches session.expiresIn
        },
    },
    user: {
        additionalFields: {
            username: {
                type: "string",
                required: false,
            },
            recommendationsEnabled: {
                type: "boolean",
                required: false,
                defaultValue: false,
                fieldName: "recommendationsEnabled",
            },
            recommendationsCollectionId: {
                type: "string",
                required: false,
                fieldName: "recommendationsCollectionId",
            },
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google"],
        },
    },
});

// Export type for use in other files
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
