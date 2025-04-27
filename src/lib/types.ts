// --- TMDB Types ---
export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
}

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  tagline: string;
}

export interface SearchResults {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

// --- Backend User Type (from Lucia) ---
export interface User {
  id: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null; // Matches Lucia attributes
  createdAt?: Date | string; // From Lucia attributes
  updatedAt?: Date | string; // From Lucia attributes
}

// --- Backend Collection Types ---

// Basic Collection Info (used in lists)
export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string; // ISO string from DB
  updated_at: string; // ISO string from DB
  owner_username: string | null;
  owner_avatar: string | null;
  // Potentially add movie count or preview images here later
}

// Movie entry within a collection (as returned by backend)
export interface CollectionMovieEntry {
  movie_id: number;
  added_at: string; // ISO string from DB
  added_by_username: string | null;
  // Note: Full Movie details (title, poster) are not stored here by default
  // We'll need to fetch them from TMDB using the movie_id
}

// Collaborator entry within a collection
export interface CollectionCollaborator {
  user_id: string;
  permission: 'view' | 'edit';
  username: string | null;
  email: string | null;
  avatar_url: string | null;
}

// Full Collection Details (returned by GET /api/collections/:id)
export interface CollectionDetails extends CollectionSummary {
  movies: CollectionMovieEntry[];
  collaborators: CollectionCollaborator[];
}

// Type for the response of GET /api/collections
export interface UserCollectionsResponse {
  collections: CollectionSummary[];
}

// Input type for adding a collaborator
export interface AddCollaboratorInput {
  email: string;
  permission: 'view' | 'edit';
}

// Input type for adding a movie to a collection
export interface AddMovieInput {
  movieId: number; // TMDB movie ID
}

// Input type for updating collection details
export interface UpdateCollectionInput {
  name?: string;
  description?: string;
}
