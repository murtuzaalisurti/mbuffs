import { createAuthClient } from "better-auth/react";

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export const authClient = createAuthClient({
    baseURL: BACKEND_BASE_URL,
});

// Export commonly used functions for convenience
export const {
    signIn,
    signOut,
    useSession,
    getSession,
} = authClient;
