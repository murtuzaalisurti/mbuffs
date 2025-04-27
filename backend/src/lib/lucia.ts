import { Lucia } from "lucia";
import { NeonHTTPAdapter } from "@lucia-auth/adapter-postgresql";
import { sql } from "./db"; // Your Neon DB connection
import { dev } from "$app/environment"; // Or use process.env.NODE_ENV

// Initialize the adapter
const adapter = new NeonHTTPAdapter(sql, {
    user: "user", // Table names must match exactly
    session: "session"
});

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            // set to `true` when using HTTPS
            secure: process.env.NODE_ENV === "production"
        }
    },
    // Map database user attributes to Lucia user object
    getUserAttributes: (attributes) => {
        return {
            username: attributes.username,
            email: attributes.email,
            avatarUrl: attributes.avatar_url,
            createdAt: attributes.created_at,
            updatedAt: attributes.updated_at
        };
    }
});

// IMPORTANT! Define the DatabaseUserAttributes interface
// This should reflect the columns in your "user" table
declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}

interface DatabaseUserAttributes {
    username: string | null; // Allow null if username isn't always required
    email: string | null;    // Allow null if email isn't always required (e.g., only OAuth)
    avatar_url: string | null;
    created_at: Date;
    updated_at: Date;
}
