import { sql } from '../lib/db.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

interface CollectionMovie {
    movie_id: string;
    is_movie: boolean;
}

interface TMDBMovie {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    vote_count?: number;
    popularity?: number;
    overview: string;
    backdrop_path: string | null;
    genre_ids?: number[];
}

interface TMDBRecommendationsResponse {
    page: number;
    results: TMDBMovie[];
    total_pages: number;
    total_results: number;
}

interface TMDBDetailsResponse {
    id: number;
    genres: { id: number; name: string }[];
    keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
}

interface RecommendationResult {
    results: TMDBMovie[];
    sourceCollections: { id: string; name: string }[];
    totalSourceItems: number;
}

/**
 * Fetch TMDB API data
 */
async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    if (!TMDB_API_KEY) {
        console.error("TMDB API key is missing");
        return null;
    }
    
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    url.searchParams.append('language', 'en-US');
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`TMDB API Error (${response.status}) on ${endpoint}`);
            return null;
        }
        return await response.json() as T;
    } catch (error) {
        console.error(`TMDB Network error on ${endpoint}:`, error);
        return null;
    }
}

/**
 * Get recommendations from TMDB for a specific movie/TV show
 */
async function getRecommendationsForItem(movieId: number, isMovie: boolean): Promise<TMDBMovie[]> {
    const mediaType = isMovie ? 'movie' : 'tv';
    const response = await fetchTMDB<TMDBRecommendationsResponse>(
        `/${mediaType}/${movieId}/recommendations`
    );
    return response?.results || [];
}

/**
 * Get similar content from TMDB for a specific movie/TV show
 */
async function getSimilarForItem(movieId: number, isMovie: boolean): Promise<TMDBMovie[]> {
    const mediaType = isMovie ? 'movie' : 'tv';
    const response = await fetchTMDB<TMDBRecommendationsResponse>(
        `/${mediaType}/${movieId}/similar`
    );
    return response?.results || [];
}

/**
 * Get details including genres for a movie/TV show
 */
async function getItemDetails(movieId: number, isMovie: boolean): Promise<TMDBDetailsResponse | null> {
    const mediaType = isMovie ? 'movie' : 'tv';
    const response = await fetchTMDB<TMDBDetailsResponse>(
        `/${mediaType}/${movieId}`,
        { append_to_response: 'keywords' }
    );
    return response;
}

/**
 * Parse movie ID from collection_movies format
 * Movies are stored as numeric IDs, TV shows as "12345tv"
 */
function parseMovieId(movieIdStr: string): { id: number; isMovie: boolean } {
    if (movieIdStr.endsWith('tv')) {
        return {
            id: parseInt(movieIdStr.slice(0, -2), 10),
            isMovie: false
        };
    }
    return {
        id: parseInt(movieIdStr, 10),
        isMovie: true
    };
}

/**
 * Get user's recommendation source collections
 */
async function getUserRecommendationCollections(userId: string): Promise<{ id: string; name: string }[]> {
    const result = await sql`
        SELECT c.id, c.name
        FROM user_recommendation_collections urc
        JOIN collections c ON urc.collection_id = c.id
        WHERE urc.user_id = ${userId}
        ORDER BY urc.added_at DESC
    `;
    return result as { id: string; name: string }[];
}

/**
 * Get all movies from user's recommendation source collections
 */
async function getMoviesFromRecommendationCollections(userId: string): Promise<CollectionMovie[]> {
    const result = await sql`
        SELECT DISTINCT cm.movie_id, cm.is_movie
        FROM collection_movies cm
        JOIN user_recommendation_collections urc ON cm.collection_id = urc.collection_id
        WHERE urc.user_id = ${userId}
    `;
    return result as CollectionMovie[];
}

/**
 * Main recommendation algorithm
 * 
 * Strategy:
 * 1. Get all movies/TV shows from user's recommendation source collections
 * 2. For each item, fetch TMDB recommendations and similar content
 * 3. Analyze genres to build a preference profile
 * 4. Score and rank recommendations based on:
 *    - How many times they appear (popularity across sources)
 *    - Genre match with user preferences
 *    - TMDB rating and popularity
 * 5. Filter out items already in user's collections
 * 6. Return top recommendations
 */
export async function generateRecommendations(
    userId: string,
    limit: number = 20
): Promise<RecommendationResult> {
    // Check if user has recommendations enabled
    const userResult = await sql`
        SELECT recommendations_enabled FROM "user" WHERE id = ${userId}
    `;
    
    if (userResult.length === 0 || !userResult[0].recommendations_enabled) {
        return { results: [], sourceCollections: [], totalSourceItems: 0 };
    }
    
    // Get source collections
    const sourceCollections = await getUserRecommendationCollections(userId);
    if (sourceCollections.length === 0) {
        return { results: [], sourceCollections: [], totalSourceItems: 0 };
    }
    
    // Get all movies from recommendation source collections
    const sourceMovies = await getMoviesFromRecommendationCollections(userId);
    if (sourceMovies.length === 0) {
        return { results: [], sourceCollections, totalSourceItems: 0 };
    }
    
    // Get all movies the user already has in ANY of their collections (to filter out)
    const existingMoviesResult = await sql`
        SELECT DISTINCT cm.movie_id
        FROM collection_movies cm
        JOIN collections c ON cm.collection_id = c.id
        WHERE c.owner_id = ${userId}
        OR c.id IN (SELECT collection_id FROM collection_collaborators WHERE user_id = ${userId})
    `;
    const existingMovieIds = new Set(
        (existingMoviesResult as { movie_id: string }[]).map(m => m.movie_id)
    );
    
    // Build genre preference profile
    const genreScores: Map<number, number> = new Map();
    const allRecommendations: Map<string, { item: TMDBMovie; score: number; sources: number }> = new Map();
    
    // Sample a subset of source movies to avoid rate limiting (max 10 for API calls)
    const sampleSize = Math.min(sourceMovies.length, 10);
    const sampledMovies = sourceMovies
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);
    
    // Fetch details and recommendations for each sampled source item
    const fetchPromises = sampledMovies.map(async (movie) => {
        const { id, isMovie } = parseMovieId(movie.movie_id);
        
        // Get details for genre profiling
        const details = await getItemDetails(id, isMovie);
        if (details?.genres) {
            details.genres.forEach(genre => {
                genreScores.set(genre.id, (genreScores.get(genre.id) || 0) + 1);
            });
        }
        
        // Get recommendations and similar content
        const [recommendations, similar] = await Promise.all([
            getRecommendationsForItem(id, isMovie),
            getSimilarForItem(id, isMovie)
        ]);
        
        return { isMovie, recommendations, similar };
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Process all recommendations
    results.forEach(({ isMovie, recommendations, similar }) => {
        const allItems = [...recommendations, ...similar];
        
        allItems.forEach(item => {
            // Create a unique key for deduplication
            const key = isMovie ? `${item.id}` : `${item.id}tv`;
            
            // Skip items already in user's collections
            if (existingMovieIds.has(key)) return;
            
            // Calculate genre match score
            let genreMatchScore = 0;
            if (item.genre_ids) {
                item.genre_ids.forEach(genreId => {
                    genreMatchScore += genreScores.get(genreId) || 0;
                });
            }
            
            // Calculate combined score
            const baseScore = (item.vote_average || 0) * 10;
            const popularityScore = Math.min((item.popularity || 0) / 10, 50);
            const combinedScore = baseScore + popularityScore + genreMatchScore * 5;
            
            const existing = allRecommendations.get(key);
            if (existing) {
                // Item appeared from multiple sources - boost its score
                existing.sources += 1;
                existing.score = combinedScore + (existing.sources * 20);
            } else {
                allRecommendations.set(key, {
                    item,
                    score: combinedScore,
                    sources: 1
                });
            }
        });
    });
    
    // Sort by score and return top recommendations
    const sortedRecommendations = Array.from(allRecommendations.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.item);
    
    return {
        results: sortedRecommendations,
        sourceCollections,
        totalSourceItems: sourceMovies.length
    };
}

/**
 * Add a collection to user's recommendation sources
 */
export async function addRecommendationCollection(
    userId: string,
    collectionId: string
): Promise<boolean> {
    try {
        // Verify user has access to this collection
        const collectionCheck = await sql`
            SELECT id FROM collections 
            WHERE id = ${collectionId} 
            AND (owner_id = ${userId} OR id IN (
                SELECT collection_id FROM collection_collaborators WHERE user_id = ${userId}
            ))
        `;
        
        if (collectionCheck.length === 0) {
            return false;
        }
        
        // Add to recommendation collections
        await sql`
            INSERT INTO user_recommendation_collections (id, user_id, collection_id, added_at)
            VALUES (gen_random_uuid()::text, ${userId}, ${collectionId}, NOW())
            ON CONFLICT (user_id, collection_id) DO NOTHING
        `;
        
        return true;
    } catch (error) {
        console.error("Error adding recommendation collection:", error);
        return false;
    }
}

/**
 * Remove a collection from user's recommendation sources
 */
export async function removeRecommendationCollection(
    userId: string,
    collectionId: string
): Promise<boolean> {
    try {
        await sql`
            DELETE FROM user_recommendation_collections
            WHERE user_id = ${userId} AND collection_id = ${collectionId}
        `;
        return true;
    } catch (error) {
        console.error("Error removing recommendation collection:", error);
        return false;
    }
}

/**
 * Set recommendation collections (replace all)
 */
export async function setRecommendationCollections(
    userId: string,
    collectionIds: string[]
): Promise<boolean> {
    try {
        // Verify user has access to all collections
        if (collectionIds.length > 0) {
            const collectionCheck = await sql`
                SELECT id FROM collections 
                WHERE id = ANY(${collectionIds})
                AND (owner_id = ${userId} OR id IN (
                    SELECT collection_id FROM collection_collaborators WHERE user_id = ${userId}
                ))
            `;
            
            if (collectionCheck.length !== collectionIds.length) {
                return false;
            }
        }
        
        // Remove all existing recommendation collections
        await sql`
            DELETE FROM user_recommendation_collections
            WHERE user_id = ${userId}
        `;
        
        // Add new ones
        for (const collectionId of collectionIds) {
            await sql`
                INSERT INTO user_recommendation_collections (id, user_id, collection_id, added_at)
                VALUES (gen_random_uuid()::text, ${userId}, ${collectionId}, NOW())
            `;
        }
        
        return true;
    } catch (error) {
        console.error("Error setting recommendation collections:", error);
        return false;
    }
}
