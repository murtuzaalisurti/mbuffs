import { authClient, useSession, signIn, signOut } from '../lib/auth-client';

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export const useAuth = () => {
    const { data: session, isPending: isLoading, error } = useSession();

    const handleSignIn = async () => {
        await signIn.social({
            provider: "google",
            callbackURL: window.location.origin,
        });
    };

    const handleSignOut = async () => {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    // Optionally redirect after logout
                    window.location.href = '/';
                },
            },
        });
    };

    // Map session user to match the expected shape
    const user = session?.user ? {
        id: session.user.id,
        email: session.user.email,
        username: (session.user as { username?: string }).username || session.user.name,
        avatarUrl: session.user.image,
        name: session.user.name,
        image: session.user.image,
        createdAt: session.user.createdAt,
        // Custom fields - these will be fetched from /api/user/preferences endpoint
        recommendationsEnabled: (session.user as { recommendationsEnabled?: boolean }).recommendationsEnabled,
        recommendationsCollectionId: (session.user as { recommendationsCollectionId?: string }).recommendationsCollectionId,
    } : null;

    return {
        user,
        isLoggedIn: !!session?.user,
        isLoadingUser: isLoading,
        isUserError: !!error,
        userError: error,
        logout: handleSignOut,
        signIn: handleSignIn,
        isLoggingOut: false, // Better Auth handles this internally
        session,
    };
};
