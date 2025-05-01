import {
    Movie, MovieDetails, SearchResults, User,
    CollectionSummary, CollectionDetails, CollectionCollaborator, UserCollectionsResponse,
    CreateCollectionInput, UpdateCollectionInput, AddMovieInput, AddCollaboratorInput,
    UpdateCollaboratorInput, AddMovieResponse
} from './types';

// --- Backend API Configuration ---
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const JWT_TOKEN_KEY = 'authToken'; // Key for localStorage

const interleaveArrays = <T>(arr1: T[], arr2: T[]): T[] => {
    const maxLength = Math.max(arr1.length, arr2.length);
    const result: T[] = [];
    for (let i = 0; i < maxLength; i++) {
        // Add item from arr1 if it exists
        if (i < arr1.length) {
            result.push(arr1[i]);
        }
        // Add item from arr2 if it exists
        if (i < arr2.length) {
            result.push(arr2[i]);
        }
    }
    return result;
};

// Helper function for backend fetch requests
export const fetchBackend = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${BACKEND_BASE_URL}/api${endpoint}`;
    const token = localStorage.getItem(JWT_TOKEN_KEY);

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const requestOptions: RequestInit = {
        // Remove credentials: 'include' if using Authorization header, unless CORS requires it
        headers: headers,
        ...options,
    };

    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            let errorData = { message: `HTTP error ${response.status}` };
            try {
                const jsonError = await response.json();
                errorData = { ...errorData, ...jsonError };
            } catch (e) { /* Ignore JSON parsing error */ }
            
            console.error(`API Error (${response.status}) on ${endpoint}:`, errorData);
            
            // --- Removed automatic token clearing on 401 --- 
            // It's generally better to handle token expiry/invalidation 
            // within the useAuth hook based on the query status, or 
            // implement a proper token refresh strategy.
            // if (response.status === 401) {
            //     localStorage.removeItem(JWT_TOKEN_KEY);
            // }

            const error = new Error(errorData.message) as any; // eslint-disable-line
            error.status = response.status;
            error.data = errorData;
            throw error;
        }

        if (response.status === 204 || (response.headers.get('content-length') === '0' && options.method !== 'GET')) {
            return null;
        }
        return await response.json();
    } catch (error) {
        // Log network errors or other unexpected issues
        console.error(`Network or unexpected error on ${endpoint}:`, error);
        throw error; // Re-throw the error to be caught by the caller (e.g., React Query)
    }
};

// --- Auth API Functions ---
export const fetchCurrentUserApi = async (): Promise<{ user: User }> => {
    return fetchBackend('/auth/me');
};

export const logoutUserApi = async (): Promise<void> => {
    try {
       await fetchBackend('/auth/logout', { method: 'POST' }); 
    } catch (error) {
        console.warn("Optional backend logout call failed:", error);
    }
};

// --- Collection API Functions (No changes needed, use fetchBackend) ---
export const fetchUserCollectionsApi = async (): Promise<UserCollectionsResponse> => {
    return fetchBackend('/collections');
};

export const fetchCollectionDetailsApi = async (collectionId: string): Promise<CollectionDetails> => {
    return fetchBackend(`/collections/${collectionId}`);
};

export const createCollectionApi = async (data: CreateCollectionInput): Promise<{ collection: CollectionSummary }> => {
    return fetchBackend('/collections', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const updateCollectionApi = async (collectionId: string, data: UpdateCollectionInput): Promise<{ collection: CollectionSummary }> => {
    return fetchBackend(`/collections/${collectionId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const deleteCollectionApi = async (collectionId: string): Promise<void> => {
    await fetchBackend(`/collections/${collectionId}`, { method: 'DELETE' });
};

// --- Collection Movies API (No changes needed) ---
export const addMovieToCollectionApi = async (collectionId: string, data: AddMovieInput): Promise<AddMovieResponse> => {
    return fetchBackend(`/collections/${collectionId}/movies`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const removeMovieFromCollectionApi = async (collectionId: string, movieId: number): Promise<void> => {
    await fetchBackend(`/collections/${collectionId}/movies/${movieId}`, { method: 'DELETE' });
};

// --- Collection Collaborators API (No changes needed) ---
export const addCollaboratorApi = async (collectionId: string, data: AddCollaboratorInput): Promise<{ collaborator: CollectionCollaborator }> => {
    return fetchBackend(`/collections/${collectionId}/collaborators`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const updateCollaboratorApi = async (collectionId: string, userId: string, data: UpdateCollaboratorInput): Promise<{ collaborator: CollectionCollaborator }> => {
    return fetchBackend(`/collections/${collectionId}/collaborators/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const removeCollaboratorApi = async (collectionId: string, userId: string): Promise<void> => {
    await fetchBackend(`/collections/${collectionId}/collaborators/${userId}`, { method: 'DELETE' });
};

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export const getImageUrl = (path: string | null | undefined, size = 'w500') => {
    if (!path) return '/placeholder.svg';
    return `${IMAGE_BASE_URL}/${size}${path}`;
};

export const fetchPopularMoviesApi = async (): Promise<Movie[]> => {
    try {
        const data = await fetchBackend(`/content`, {
            method: 'POST',
            body: JSON.stringify({
                endpoint: `/movie/popular`,
            }),
        });
        return data?.results || [];
    } catch (error) { console.error("Failed to fetch popular movies:", error); return []; }
};

export const fetchMovieDetailsApi = async (id: number): Promise<MovieDetails | null> => {
    try {
        return await fetchBackend(`/content`, {
            method: 'POST',
            body: JSON.stringify({
                endpoint: `/movie/${id}`,
            }),
        });
    }
    catch (error) {
        console.error(`Failed to fetch details for movie ${id}:`, error);
        return null;
    }
};

export const fetchTvDetailsApi = async (id: number): Promise<MovieDetails | null> => {
    try {
        return await fetchBackend(`/content`, {
            method: 'POST',
            body: JSON.stringify({
                endpoint: `/tv/${id}`,
            }),
        });
    }
    catch (error) {
        console.error(`Failed to fetch details for TV show ${id}:`, error);
        return null;
    }
};

export const searchMoviesApi = async (query: string, page = 1): Promise<SearchResults> => {
    const defaultResult: SearchResults = { page: 0, results: [], total_pages: 0, total_results: 0 };
    if (!query) return defaultResult;
    try {
        const movieData = await fetchBackend(`/content`, {
            method: 'POST',
            body: JSON.stringify({
                endpoint: `/search/movie`,
                params: {
                    query, 
                    page: String(page)
                },
            }),
        });

        const tvData = await fetchBackend(`/content`, {
            method: 'POST',
            body: JSON.stringify({
                endpoint: `/search/tv`,
                params: {
                    query, 
                    page: String(page)
                },
            }),
        });

        // Get the results arrays, defaulting to empty arrays
        const movieResults = movieData?.results || [];
        const tvResults = tvData?.results || [];

        // Interleave the results for better relevance mixing
        const combinedResults = interleaveArrays(movieResults, tvResults) as Movie[];

        // If both searches failed or returned no results, return default
        if (combinedResults.length === 0 && !movieData && !tvData) {
            return defaultResult;
        }

        // Use movie data for primary pagination, sum total results
        const finalPage = movieData?.page ?? tvData?.page ?? 0;
        const finalTotalPages = Math.max(movieData?.total_pages ?? 0, tvData?.total_pages ?? 0); // Or use movieData's? Depends on desired UX
        const finalTotalResults = (movieData?.total_results ?? 0) + (tvData?.total_results ?? 0);

        return {
            page: finalPage,
            results: combinedResults,
            total_pages: finalTotalPages,
            total_results: finalTotalResults,
        };
    } catch (error) {
        console.error(`Failed to search movies for query "${query}":`, error);
        return defaultResult;
    }
};