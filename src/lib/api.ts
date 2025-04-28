import {
    Movie, MovieDetails, SearchResults, User,
    CollectionSummary, CollectionDetails, CollectionCollaborator, UserCollectionsResponse,
    CreateCollectionInput, UpdateCollectionInput, AddMovieInput, AddCollaboratorInput, 
    UpdateCollaboratorInput, // Added missing import
    AddMovieResponse // Added missing import
} from './types';

// --- Backend API Configuration ---
// Ensure VITE_BACKEND_URL includes the /api prefix if your backend routes use it
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'; 

// Helper function for backend fetch requests
export const fetchBackend = async (endpoint: string, options: RequestInit = {}) => {
    // Prepend /api if necessary, or adjust VITE_BACKEND_URL
    const url = `${BACKEND_BASE_URL}/api${endpoint}`;
    const defaultOptions: RequestInit = {
        credentials: 'include', 
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    };

        const response = await fetch(url, defaultOptions);
        if (!response.ok) {
            let errorData = { message: `HTTP error ${response.status}` }; // Default error
            try { 
                // Try to parse JSON error, but don't fail if it's not JSON
                const jsonError = await response.json();
                errorData = { ...errorData, ...jsonError }; 
            }
            catch (e) { /* Ignore JSON parsing error */ }
            console.error(`API Error (${response.status}) on ${endpoint}:`, errorData);
            const error = new Error(errorData.message) as any; // eslint-disable-line
            error.status = response.status;
            error.data = errorData; // Attach full error data if available
            throw error;
        }
        // Handle potentially empty responses for non-GET requests
        if (response.status === 204 || (response.headers.get('content-length') === '0' && options.method !== 'GET')) {
            return null; // Return null for empty responses (e.g., DELETE, successful PUT/POST with no body)
        }
        return await response.json();
};

// --- Auth API Functions ---
export const fetchCurrentUserApi = async (): Promise<{ user: User }> => {
    return fetchBackend('/auth/me');
};
export const logoutUserApi = async (): Promise<void> => {
    await fetchBackend('/auth/logout', { method: 'POST' });
};

// --- Collection API Functions ---
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

// --- Collection Movies API ---
// Updated return type
export const addMovieToCollectionApi = async (collectionId: string, data: AddMovieInput): Promise<AddMovieResponse> => {
    return fetchBackend(`/collections/${collectionId}/movies`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const removeMovieFromCollectionApi = async (collectionId: string, movieId: number): Promise<void> => {
    await fetchBackend(`/collections/${collectionId}/movies/${movieId}`, { method: 'DELETE' });
};

// --- Collection Collaborators API ---
export const addCollaboratorApi = async (collectionId: string, data: AddCollaboratorInput): Promise<{ collaborator: CollectionCollaborator }> => {
    return fetchBackend(`/collections/${collectionId}/collaborators`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

// Updated return type (assuming backend returns the updated collaborator)
export const updateCollaboratorApi = async (collectionId: string, userId: string, data: UpdateCollaboratorInput): Promise<{ collaborator: CollectionCollaborator }> => {
    return fetchBackend(`/collections/${collectionId}/collaborators/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const removeCollaboratorApi = async (collectionId: string, userId: string): Promise<void> => {
    await fetchBackend(`/collections/${collectionId}/collaborators/${userId}`, { method: 'DELETE' });
};

// --- TMDB API Configuration & Functions ---
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

if (!TMDB_API_KEY) {
    console.warn("TMDB API key (VITE_TMDB_API_KEY) is missing. Movie functionality will be limited.");
}

export const getImageUrl = (path: string | null | undefined, size = 'w500') => {
    if (!path) return '/placeholder.svg'; // Use a local placeholder
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

        const response = await fetch(url.toString());
        if (!response.ok) {
            let errorData = { status_message: `HTTP error ${response.status}` }; // Default error
             try { 
                const jsonError = await response.json();
                errorData = { ...errorData, ...jsonError }; 
            } catch (e) { /* Ignore JSON parsing error */ }
            console.error(`TMDB API Error (${response.status}) on ${endpoint}:`, errorData);
            throw new Error(errorData.status_message);
        }
        return await response.json();
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