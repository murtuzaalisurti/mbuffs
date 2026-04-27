import { useEffect, useMemo, useState } from 'react';
import { useSession, signOut } from '../lib/auth-client';

const AUTH_SNAPSHOT_STORAGE_KEY = 'mbuffs_auth_snapshot_v1';
const AUTH_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type AuthUser = {
    id: string;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    image?: string | null;
    createdAt?: string | Date;
    recommendationsEnabled?: boolean;
    recommendationsCollectionId?: string | null;
    showRedditLabel?: boolean;
    role?: string;
};

type AuthSnapshot = {
    savedAt: number;
    user: AuthUser;
};

const readAuthSnapshot = (): AuthUser | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    const rawSnapshot = localStorage.getItem(AUTH_SNAPSHOT_STORAGE_KEY);
    if (!rawSnapshot) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawSnapshot) as Partial<AuthSnapshot>;
        const isExpired =
            typeof parsed.savedAt !== 'number' ||
            Date.now() - parsed.savedAt > AUTH_SNAPSHOT_MAX_AGE_MS;

        if (isExpired || !parsed.user || typeof parsed.user.id !== 'string' || typeof parsed.user.email !== 'string') {
            localStorage.removeItem(AUTH_SNAPSHOT_STORAGE_KEY);
            return null;
        }

        return parsed.user;
    } catch {
        localStorage.removeItem(AUTH_SNAPSHOT_STORAGE_KEY);
        return null;
    }
};

const persistAuthSnapshot = (user: AuthUser) => {
    if (typeof window === 'undefined') {
        return;
    }

    const snapshot: AuthSnapshot = {
        savedAt: Date.now(),
        user,
    };

    localStorage.setItem(AUTH_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
};

const clearAuthSnapshot = () => {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem(AUTH_SNAPSHOT_STORAGE_KEY);
};

const mapSessionUser = (sessionUser: unknown): AuthUser | null => {
    if (!sessionUser || typeof sessionUser !== 'object') {
        return null;
    }

    const user = sessionUser as Record<string, unknown>;

    if (typeof user.id !== 'string' || typeof user.email !== 'string') {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        username: typeof user.username === 'string' ? user.username : (typeof user.name === 'string' ? user.name : null),
        avatarUrl: typeof user.image === 'string' ? user.image : null,
        name: typeof user.name === 'string' ? user.name : null,
        firstName: typeof user.firstName === 'string' ? user.firstName : null,
        lastName: typeof user.lastName === 'string' ? user.lastName : null,
        image: typeof user.image === 'string' ? user.image : null,
        createdAt: user.createdAt as string | Date | undefined,
        recommendationsEnabled: typeof user.recommendationsEnabled === 'boolean' ? user.recommendationsEnabled : undefined,
        recommendationsCollectionId: typeof user.recommendationsCollectionId === 'string' ? user.recommendationsCollectionId : null,
        showRedditLabel: typeof user.showRedditLabel === 'boolean' ? user.showRedditLabel : undefined,
        role: typeof user.role === 'string' ? user.role : undefined,
    };
};

const isUnauthorizedSessionError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const maybeStatus = (error as { status?: unknown }).status;
    return maybeStatus === 401;
};

export const useAuth = () => {
    const { data: session, isPending: isLoading, error } = useSession();
    const [cachedUser, setCachedUser] = useState<AuthUser | null>(() => readAuthSnapshot());
    const sessionUser = useMemo(() => mapSessionUser(session?.user), [session]);

    useEffect(() => {
        if (sessionUser) {
            setCachedUser(sessionUser);
            persistAuthSnapshot(sessionUser);
            return;
        }

        if (!isLoading && (error === null || isUnauthorizedSessionError(error))) {
            setCachedUser(null);
            clearAuthSnapshot();
        }
    }, [sessionUser, isLoading, error]);

    const user = sessionUser ?? cachedUser;
    const isLoggedIn = Boolean(user);

    const handleSignOut = async () => {
        setCachedUser(null);
        clearAuthSnapshot();

        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    // Optionally redirect after logout
                    window.location.href = '/';
                },
            },
        });
    };

    const handleSignIn = () => {
        window.location.href = '/login';
    };

    return {
        user,
        isLoggedIn,
        isLoadingUser: isLoading && !user,
        isSessionRefreshing: isLoading && !!user,
        isUserError: !!error,
        userError: error,
        signIn: handleSignIn,
        logout: handleSignOut,
        isLoggingOut: false, // Better Auth handles this internally
        session,
    };
};
