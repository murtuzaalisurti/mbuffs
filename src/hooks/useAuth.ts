import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUserApi, logoutUserApi } from '../lib/api';
import { User } from '../lib/types';

const USER_QUERY_KEY = ['user'];
const JWT_TOKEN_KEY = 'authToken'; // Key for localStorage

export const useAuth = () => {
  const queryClient = useQueryClient();

  // Function to get token from localStorage
  const getToken = (): string | null => localStorage.getItem(JWT_TOKEN_KEY);

  // Function to set token in localStorage
  const setToken = (token: string): void => {
    localStorage.setItem(JWT_TOKEN_KEY, token);
    // When token changes, likely means user logged in/out, invalidate user query
    queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
  };

  // Function to remove token from localStorage
  const removeToken = (): void => {
    localStorage.removeItem(JWT_TOKEN_KEY);
    // Invalidate user query after removing token
    queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
  };

  // Query to fetch the current user (enabled only if token exists)
  const { data: userData, isLoading, error, isError, isSuccess } = useQuery<
    { user: User }, // Success data type
    Error // Error type
  >({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchCurrentUserApi,
    enabled: !!getToken(), // Only run query if token exists
    retry: (failureCount, error: any) => {
      // Don't retry on 401 Unauthorized (means token is invalid/expired)
      if (error?.status === 401) {
        removeToken(); // Clear invalid token
        return false;
      }
      // Standard retry logic for other errors
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000, // Refetch user data periodically (e.g., 5 mins)
    gcTime: 15 * 60 * 1000, // Keep data for 15 mins if not used
  });

  // Mutation to handle logout (now just removes the token)
  const { mutate: logout, isPending: isLoggingOut } = useMutation<void, Error>({ // Specify types
    mutationFn: async () => {
        // Optional: Call backend logout if it does anything useful (like invalidating refresh tokens in future)
        // await logoutUserApi(); 
        removeToken(); // Primary action is removing local token
    },
    onSuccess: () => {
      console.log("Local token removed, user logged out.");
      // No need to invalidate user query here, removeToken already does
      // Optional: Redirect after logout
      // window.location.href = '/';
    },
    onError: (error) => {
      // Handle potential errors if backend logout is called
      console.error("Logout failed (potentially backend error):", error);
      // Even if backend call fails, ensure local token is removed
      removeToken(); 
    },
  });

  // Effect to handle token from URL (e.g., after OAuth redirect)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    if (token) {
      setToken(token);
      // Clean the token from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []); // Run only once on component mount

  return {
    user: userData?.user ?? null,
    isLoggedIn: !!getToken() && isSuccess && !!userData?.user, // Check token presence AND successful fetch
    isLoadingUser: isLoading,
    isUserError: isError,
    userError: error,
    logout,
    isLoggingOut,
    getToken, // Expose getToken if needed elsewhere
    setToken, // Expose setToken if login happens outside OAuth
  };
};
