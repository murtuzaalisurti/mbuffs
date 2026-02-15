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

interface TMDBCrewMember {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
}

interface TMDBCastMember {
    id: number;
    name: string;
    character: string;
    order: number; // Billing order (0 = lead)
    profile_path: string | null;
}

interface TMDBCreditsResponse {
    id: number;
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
}

interface TMDBDiscoverResponse {
    page: number;
    results: TMDBMovie[];
    total_pages: number;
    total_results: number;
}

interface DirectorInfo {
    id: number;
    name: string;
    count: number; // How many times this director appears in source collections
}

interface ActorInfo {
    id: number;
    name: string;
    count: number; // How many times this actor appears in source collections
}

interface RecommendationResult {
    results: TMDBMovie[];
    sourceCollections: { id: string; name: string }[];
    totalSourceItems: number;
    page: number;
    total_pages: number;
    total_results: number;
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
 * Get credits (including directors) for a movie/TV show
 */
async function getItemCredits(movieId: number, isMovie: boolean): Promise<TMDBCreditsResponse | null> {
    const mediaType = isMovie ? 'movie' : 'tv';
    const response = await fetchTMDB<TMDBCreditsResponse>(
        `/${mediaType}/${movieId}/credits`
    );
    return response;
}

/**
 * Extract directors from credits response
 * For movies: crew members with job "Director"
 * For TV shows: crew members with job "Director" or department "Directing"
 */
function extractDirectors(credits: TMDBCreditsResponse | null, isMovie: boolean): TMDBCrewMember[] {
    if (!credits?.crew) return [];
    
    if (isMovie) {
        return credits.crew.filter(member => member.job === 'Director');
    } else {
        // For TV shows, include showrunners and main directors
        return credits.crew.filter(member => 
            member.job === 'Director' || 
            member.department === 'Directing'
        );
    }
}

/**
 * Extract top cast from credits response
 * Returns lead actors (top 3 billed) from the cast
 */
function extractTopCast(credits: TMDBCreditsResponse | null): TMDBCastMember[] {
    if (!credits?.cast) return [];
    
    // Get top 3 billed actors (leads)
    return credits.cast
        .sort((a, b) => a.order - b.order)
        .slice(0, 3);
}

/**
 * Discover movies/TV shows by a specific director using TMDB discover API
 * Filters by user's preferred genres to show most relevant works
 * Returns high-rated works by the director in the specified genres
 */
async function discoverByDirector(
    directorId: number, 
    isMovie: boolean, 
    preferredGenreIds: number[] = []
): Promise<TMDBMovie[]> {
    const mediaType = isMovie ? 'movie' : 'tv';
    
    const params: Record<string, string> = {
        with_crew: directorId.toString(),
        sort_by: 'vote_average.desc',
        'vote_count.gte': '100', // Only include well-rated works
        page: '1'
    };
    
    // Filter by preferred genres if available (use OR logic with pipe separator)
    if (preferredGenreIds.length > 0) {
        params.with_genres = preferredGenreIds.join('|');
    }
    
    const response = await fetchTMDB<TMDBDiscoverResponse>(
        `/discover/${mediaType}`,
        params
    );
    return response?.results || [];
}

/**
 * Discover movies/TV shows by a specific actor using TMDB discover API
 * Filters by user's preferred genres to show most relevant works
 * Returns popular, high-rated works featuring the actor
 */
async function discoverByActor(
    actorId: number, 
    isMovie: boolean, 
    preferredGenreIds: number[] = []
): Promise<TMDBMovie[]> {
    const mediaType = isMovie ? 'movie' : 'tv';
    
    const params: Record<string, string> = {
        with_cast: actorId.toString(),
        sort_by: 'popularity.desc', // Popular works for actors
        'vote_count.gte': '100',
        page: '1'
    };
    
    // Filter by preferred genres if available
    if (preferredGenreIds.length > 0) {
        params.with_genres = preferredGenreIds.join('|');
    }
    
    const response = await fetchTMDB<TMDBDiscoverResponse>(
        `/discover/${mediaType}`,
        params
    );
    return response?.results || [];
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
 * 2. For each item, fetch TMDB recommendations and similar content (PRIMARY source)
 * 3. Analyze genres to build a preference profile
 * 4. Analyze directors and actors to build preference profiles
 * 5. Fetch a small number of best works from favorite directors (supplementary)
 * 6. Fetch a small number of popular works from favorite actors (supplementary)
 * 7. Score and rank recommendations based on:
 *    - How many times they appear (popularity across sources)
 *    - Genre match with user preferences (primary factor)
 *    - TMDB rating and popularity
 *    - Small boost for director/actor matches
 * 8. Filter out items already in user's collections
 * 9. Return top recommendations
 */
export async function generateRecommendations(
    userId: string,
    limit: number = 20,
    page: number = 1
): Promise<RecommendationResult> {
    const emptyResult: RecommendationResult = { 
        results: [], 
        sourceCollections: [], 
        totalSourceItems: 0,
        page: 1,
        total_pages: 0,
        total_results: 0
    };

    // Check if user has recommendations enabled
    const userResult = await sql`
        SELECT recommendations_enabled FROM "user" WHERE id = ${userId}
    `;
    
    if (userResult.length === 0 || !userResult[0].recommendations_enabled) {
        return emptyResult;
    }
    
    // Get source collections
    const sourceCollections = await getUserRecommendationCollections(userId);
    if (sourceCollections.length === 0) {
        return emptyResult;
    }
    
    // Get all movies from recommendation source collections
    const sourceMovies = await getMoviesFromRecommendationCollections(userId);
    if (sourceMovies.length === 0) {
        return { ...emptyResult, sourceCollections };
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
    
    // Build genre, director, and actor preference profiles
    const genreScores: Map<number, number> = new Map();
    const directorScores: Map<number, DirectorInfo> = new Map();
    const actorScores: Map<number, ActorInfo> = new Map();
    const allRecommendations: Map<string, { item: TMDBMovie; score: number; sources: number; isDirectorBased?: boolean; isActorBased?: boolean }> = new Map();
    
    // Sample a subset of source movies to avoid rate limiting (max 10 for API calls)
    const sampleSize = Math.min(sourceMovies.length, 10);
    const sampledMovies = sourceMovies
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);
    
    // Fetch details, credits, and recommendations for each sampled source item
    const fetchPromises = sampledMovies.map(async (movie) => {
        const { id, isMovie } = parseMovieId(movie.movie_id);
        
        // Get details for genre profiling and credits for director profiling
        const [details, credits, recommendations, similar] = await Promise.all([
            getItemDetails(id, isMovie),
            getItemCredits(id, isMovie),
            getRecommendationsForItem(id, isMovie),
            getSimilarForItem(id, isMovie)
        ]);
        
        // Build genre profile
        if (details?.genres) {
            details.genres.forEach(genre => {
                genreScores.set(genre.id, (genreScores.get(genre.id) || 0) + 1);
            });
        }
        
        // Build director profile
        const directors = extractDirectors(credits, isMovie);
        directors.forEach(director => {
            const existing = directorScores.get(director.id);
            if (existing) {
                existing.count += 1;
            } else {
                directorScores.set(director.id, {
                    id: director.id,
                    name: director.name,
                    count: 1
                });
            }
        });
        
        // Build actor profile (top billed cast)
        const topCast = extractTopCast(credits);
        topCast.forEach(actor => {
            const existing = actorScores.get(actor.id);
            if (existing) {
                existing.count += 1;
            } else {
                actorScores.set(actor.id, {
                    id: actor.id,
                    name: actor.name,
                    count: 1
                });
            }
        });
        
        return { isMovie, recommendations, similar };
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Process all recommendations from TMDB recommendations/similar
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
    
    // Get top directors/writers - keep it minimal (only top 2 with multiple appearances)
    const topDirectors = Array.from(directorScores.values())
        .filter(d => d.count >= 2) // Only directors appearing in 2+ source items
        .sort((a, b) => b.count - a.count)
        .slice(0, 2); // Limit to top 2 directors
    
    // Get top preferred genres (sorted by score, take top genres for filtering)
    const topGenreIds = Array.from(genreScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3) // Top 3 genres only for tighter filtering
        .map(([genreId]) => genreId);
    
    // Fetch a small number of best works from top directors, filtered by preferred genres
    const directorWorkPromises = topDirectors.map(async (director) => {
        // Fetch only movies by this director (skip TV to reduce volume)
        const movieWorks = await discoverByDirector(director.id, true, topGenreIds);
        
        return {
            director,
            // Limit to top 3 works per director
            movieWorks: movieWorks.slice(0, 3)
        };
    });
    
    const directorResults = await Promise.all(directorWorkPromises);
    
    // Process director-based recommendations (supplementary, not primary)
    // Only add a few best works from favorite directors that match user's genres
    directorResults.forEach(({ director, movieWorks }) => {
        movieWorks.forEach(item => {
            const key = `${item.id}`;
            
            // Skip items already in user's collections
            if (existingMovieIds.has(key)) return;
            
            // Calculate genre match score
            let genreMatchScore = 0;
            if (item.genre_ids) {
                item.genre_ids.forEach(genreId => {
                    genreMatchScore += genreScores.get(genreId) || 0;
                });
            }
            
            // Skip director works that don't match any preferred genres
            if (genreMatchScore === 0) return;
            
            // Genre match is primary, small director boost
            const genreWeight = genreMatchScore * 5;
            const directorBoost = director.count * 3;
            const baseScore = (item.vote_average || 0) * 10;
            const popularityScore = Math.min((item.popularity || 0) / 10, 20);
            const combinedScore = baseScore + popularityScore + genreWeight + directorBoost;
            
            const existing = allRecommendations.get(key);
            if (existing) {
                // If already recommended via similar/recommendations, give small boost
                existing.sources += 1;
                existing.score = Math.max(existing.score, combinedScore) + 10;
                existing.isDirectorBased = true;
            } else {
                allRecommendations.set(key, {
                    item,
                    score: combinedScore,
                    sources: 1,
                    isDirectorBased: true
                });
            }
        });
    });
    
    // Get top actors - keep it minimal (only top 2 with multiple appearances)
    const topActors = Array.from(actorScores.values())
        .filter(a => a.count >= 2) // Only actors appearing in 2+ source items
        .sort((a, b) => b.count - a.count)
        .slice(0, 2); // Limit to top 2 actors
    
    // Fetch a small number of popular works from top actors, filtered by preferred genres
    const actorWorkPromises = topActors.map(async (actor) => {
        // Fetch only movies by this actor (skip TV to reduce volume)
        const movieWorks = await discoverByActor(actor.id, true, topGenreIds);
        
        return {
            actor,
            // Limit to top 3 works per actor
            movieWorks: movieWorks.slice(0, 3)
        };
    });
    
    const actorResults = await Promise.all(actorWorkPromises);
    
    // Process actor-based recommendations (supplementary, not primary)
    // Only add a few popular works from favorite actors that match user's genres
    actorResults.forEach(({ actor, movieWorks }) => {
        movieWorks.forEach(item => {
            const key = `${item.id}`;
            
            // Skip items already in user's collections
            if (existingMovieIds.has(key)) return;
            
            // Calculate genre match score
            let genreMatchScore = 0;
            if (item.genre_ids) {
                item.genre_ids.forEach(genreId => {
                    genreMatchScore += genreScores.get(genreId) || 0;
                });
            }
            
            // Skip actor works that don't match any preferred genres
            if (genreMatchScore === 0) return;
            
            // Genre match is primary, small actor boost
            const genreWeight = genreMatchScore * 5;
            const actorBoost = actor.count * 3;
            const baseScore = (item.vote_average || 0) * 10;
            const popularityScore = Math.min((item.popularity || 0) / 10, 20);
            const combinedScore = baseScore + popularityScore + genreWeight + actorBoost;
            
            const existing = allRecommendations.get(key);
            if (existing) {
                // If already recommended via similar/recommendations, give small boost
                existing.sources += 1;
                existing.score = Math.max(existing.score, combinedScore) + 10;
                existing.isActorBased = true;
            } else {
                allRecommendations.set(key, {
                    item,
                    score: combinedScore,
                    sources: 1,
                    isActorBased: true
                });
            }
        });
    });
    
    // Sort by score
    const sortedRecommendations = Array.from(allRecommendations.values())
        .sort((a, b) => b.score - a.score);
    
    const totalResults = sortedRecommendations.length;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = sortedRecommendations
        .slice(startIndex, endIndex)
        .map(r => r.item);
    
    return {
        results: paginatedResults,
        sourceCollections,
        totalSourceItems: sourceMovies.length,
        page,
        total_pages: totalPages,
        total_results: totalResults
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
