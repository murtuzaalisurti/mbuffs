import {
    Movie, MovieDetails, SearchResults, User,
    CollectionSummary, CollectionDetails, CollectionCollaborator, UserCollectionsResponse,
    CreateCollectionInput, UpdateCollectionInput, AddMovieInput, AddCollaboratorInput, UpdateCollaboratorInput
} from './types';

// --- Backend API Configuration ---
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

// Helper function for backend fetch requests
export const fetchBackend = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${BACKEND_URL}${endpoint}`;
    const defaultOptions: RequestInit = {
        credentials: 'include', 
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); }
            catch (e) { errorData = { message: response.statusText }; }
            console.error(`API Error (${response.status}) on ${endpoint}:`, errorData);
            const error = new Error(errorData.message || `HTTP error ${response.status}`) as any;
            error.status = response.status;
            error.data = errorData;
            throw error;
        }
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`Network or fetch error on ${endpoint}:`, error);
        throw error;
    }
};

// --- Auth API Functions ---
export const fetchCurrentUserApi = async (): Promise<{ user: User }> => {
    return fetchBackend('/auth/me', { method: 'GET' });
};
export const logoutUserApi = async (): Promise<void> => {
    await fetchBackend('/auth/logout', { method: 'POST' });
};

// --- Collection API Functions ---
export const fetchUserCollectionsApi = async (): Promise<UserCollectionsResponse> => {
    return fetchBackend('/collections', { method: 'GET' });
};

export const fetchCollectionDetailsApi = async (collectionId: string): Promise<CollectionDetails> => {
    return fetchBackend(`/collections/${collectionId}`, { method: 'GET' });
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
export const addMovieToCollectionApi = async (collectionId: string, data: AddMovieInput): Promise<any> => {
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

export const updateCollaboratorApi = async (collectionId: string, userId: string, data: UpdateCollaboratorInput): Promise<{ collaborator: Pick<CollectionCollaborator, 'id' | 'user_id' | 'permission'> }> => {
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
            const errorData = await response.json();
            console.error(`TMDB API Error (${response.status}) on ${endpoint}:`, errorData);
            throw new Error(errorData.status_message || `HTTP error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`TMDB fetch error on ${endpoint}:`, error);
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
    try { return await fetchTmdb(`/movie/${id}`); }
    catch (error) { console.error(`Failed to fetch details for movie ${id}:`, error); return null; }
};

export const searchMoviesApi = async (query: string, page = 1): Promise<SearchResults> => {
    const defaultResult: SearchResults = { page: 0, results: [], total_pages: 0, total_results: 0 };
    if (!query) return defaultResult;
    try {
        const data = await fetchTmdb('/search/movie', { query, page: String(page) });
        return data || defaultResult;
    } catch (error) { console.error(`Failed to search movies for query "${query}":`, error); return defaultResult; }
};
