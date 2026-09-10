import { createAuthClient } from "better-auth/react";
import type { BetterFetchError } from "@better-fetch/fetch";

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export const authClient = createAuthClient({
    baseURL: BACKEND_BASE_URL,
    fetchOptions: {
        // Must be "include" for cross-origin requests (frontend and backend on
        // different domains) so the session cookie is attached to every fetch.
        // This is what lets useSession() read the auth state after the PWA
        // is closed and reopened — without it, the cookie is never sent and
        // the user appears logged out.
        credentials: "include",
    },
});

export type AuthSessionUser = {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    recommendationsEnabled?: boolean | null;
    recommendationsCollectionId?: string | null;
    showRedditLabel?: boolean | null;
    createdAt?: string | Date;
    [key: string]: unknown;
};

export type AuthSessionData = {
    user: AuthSessionUser;
    session: {
        id: string;
        userId: string;
        expiresAt: string | Date;
        token?: string;
        [key: string]: unknown;
    };
};

export type UseSessionResult = {
    data: AuthSessionData | null;
    isPending: boolean;
    isRefetching: boolean;
    error: BetterFetchError | null;
    refetch: (queryParams?: { query?: Record<string, unknown> }) => Promise<void>;
};

// Export commonly used functions for convenience
export const {
    signIn,
    signUp,
    signOut,
    getSession,
} = authClient;

export const useSession = authClient.useSession as unknown as () => UseSessionResult;
