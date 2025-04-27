import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUserApi, logoutUserApi } from '../lib/api';
import { User } from '../lib/types';

const USER_QUERY_KEY = ['user'];

export const useAuth = () => {
  const queryClient = useQueryClient();

  // Query to fetch the current user
  const { data: userData, isLoading, error, isError, isSuccess } = useQuery<
    { user: User }, // Success data type
    Error // Error type
  >({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchCurrentUserApi,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 Unauthorized (means user is not logged in)
      if (error?.status === 401) {
        return false;
      }
      // Standard retry logic for other errors (e.g., network issues)
      return failureCount < 3;
    },
    staleTime: Infinity, // User data is generally stable, refetch manually on login/logout
    gcTime: Infinity,    // Keep data even if not actively used
  });

  // Mutation to handle logout
  const { mutate: logout, isPending: isLoggingOut } = useMutation<void, Error>({ // Specify types
    mutationFn: logoutUserApi,
    onSuccess: () => {
      // Invalidate the user query to reflect logged-out state
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
      // Optional: Redirect or perform other actions after logout
      // window.location.href = '/';
    },
    onError: (error) => {
      // Handle logout errors (e.g., display a toast)
      console.error("Logout failed:", error);
      // You might use a toast library here: toast.error("Logout failed. Please try again.");
    },
  });

  return {
    user: userData?.user ?? null, // Return the user object or null
    isLoggedIn: isSuccess && !!userData?.user, // Determine login status based on successful fetch
    isLoadingUser: isLoading,
    isUserError: isError,
    userError: error,
    logout,
    isLoggingOut,
  };
};
