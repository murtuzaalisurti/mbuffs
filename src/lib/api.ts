import {
    Movie, MovieDetails, SearchResults, User,
    CollectionSummary, CollectionDetails, CollectionCollaborator, UserCollectionsResponse,
    CreateCollectionInput, UpdateCollectionInput, AddMovieInput, AddCollaboratorInput,
    UpdateCollaboratorInput, AddMovieResponse
} from './types';

// --- Backend API Configuration ---
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const JWT_TOKEN_KEY = 'authToken'; // Key for localStorage

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
        // credentials: 'include', 
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
            
            // If unauthorized (401), potentially clear the token and trigger a reload/redirect
            if (response.status === 401) {
                localStorage.removeItem(JWT_TOKEN_KEY);
                // Consider redirecting to login or refreshing the page
                // window.location.href = '/login'; 
                 // alert('Session expired. Please log in again.');
            }

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
    // No change needed here, fetchBackend handles the Authorization header
    return fetchBackend('/auth/me');
};

export const logoutUserApi = async (): Promise<void> => {
    // Backend logout might not be strictly necessary for stateless JWT,
    // but can be kept if the backend endpoint exists (e.g., for future token revokation)
    // The primary logout action (clearing local token) is in useAuth hook.
    try {
       await fetchBackend('/auth/logout', { method: 'POST' }); 
    } catch (error) {
        // Log error but don't block frontend logout
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

// --- TMDB API Configuration & Functions (No changes needed) ---
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

if (!TMDB_API_KEY) {
    console.warn("TMDB API key (VITE_TMDB_API_KEY) is missing. Movie functionality will be limited.");
}

export const getImageUrl = (path: string | null | undefined, size = 'w500') => {
    if (!path) return '/placeholder.svg';
    return `${IMAGE_BASE_URL}/${size}${path}`;
};

const fetchTmdb = async (endpoint: string, params: Record<string, string> = {}) => {
    if (!TMDB_API_KEY) {
        throw new Error("TMDB API key (VITE_TMDB_API_KEY) is missing.");
    }
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    url.searchParams.append('language', 'en-US');
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            let errorData = { status_message: `HTTP error ${response.status}` };
             try {
                const jsonError = await response.json();
                errorData = { ...errorData, ...jsonError };
            } catch (e) { /* Ignore JSON parsing error */ }
            console.error(`TMDB API Error (${response.status}) on ${endpoint}:`, errorData);
            throw new Error(errorData.status_message);
        }
        return await response.json();
    } catch (error) {
        console.error(`TMDB Network or unexpected error on ${endpoint}:`, error);
        throw error;
    }
}

export const fetchPopularMoviesApi = async (): Promise<Movie[]> => {
    try {
        const data = await fetchTmdb('/movie/popular');
        return data?.results || [];
    } catch (error) { console.error("Failed to fetch popular movies:", error); return []; }
};

export const fetchMovieDetailsApi = async (id: number): Promise<MovieDetails | null> => {
    try {
        return await fetchTmdb(`/movie/${id}`);
    }
    catch (error) {
        console.error(`Failed to fetch details for movie ${id}:`, error);
        return null;
    }
};

export const searchMoviesApi = async (query: string, page = 1): Promise<SearchResults> => {
    const defaultResult: SearchResults = { page: 0, results: [], total_pages: 0, total_results: 0 };
    if (!query) return defaultResult;
    try {
        const data = await fetchTmdb('/search/movie', { query, page: String(page) });
        return data || defaultResult;
    } catch (error) {
        console.error(`Failed to search movies for query "${query}":`, error);
        return defaultResult;
    }
};