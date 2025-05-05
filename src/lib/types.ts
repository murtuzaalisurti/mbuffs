// --- TMDB Types ---
export interface Network {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface Movie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  release_date: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
  backdrop_path: string | null;
}

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  tagline: string;
  networks: Network[];
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
  avatar_url?: string | null;
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
  owner_username?: string | null; // Optional from join
  owner_avatar?: string | null; // Optional from join
}

// Movie entry within a collection (as returned by backend)
export interface CollectionMovieEntry {
  movie_id: number;
  added_at: string; // ISO string from DB
  added_by_username: string | null;
  is_movie: boolean; // true if movie, false if TV show
}

// Collaborator entry within a collection
export interface CollectionCollaborator {
  user_id: string;
  permission: 'view' | 'edit';
  username?: string | null; // Optional from join
  email?: string | null; // Optional from join
  avatar_url?: string | null; // Optional from join
}

// Full Collection Details (returned by GET /api/collections/:id)
export interface CollectionDetails {
  movies: CollectionMovieEntry[];
  collaborators: CollectionCollaborator[];
  collection: CollectionSummary;
}

// Type for the response of GET /api/collections
export interface UserCollectionsResponse {
  collections: CollectionSummary[];
}

// Input type for creating a collection
export interface CreateCollectionInput {
    name: string;
    description?: string | null;
}

// Input type for updating collection details
export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
}

// Input type for adding a movie to a collection
export interface AddMovieInput {
  movieId: number; // TMDB movie ID
}

// Response type after adding a movie
export interface AddMovieResponse {
    movieEntry: {
        id: string;
        movie_id: number;
        added_at: string;
    }
}

// Input type for adding a collaborator
export interface AddCollaboratorInput {
  email: string;
  permission: 'view' | 'edit';
}

// Input type for updating collaborator permissions
export interface UpdateCollaboratorInput {
  permission: 'view' | 'edit';
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  userId: string;
  createdAt: string; // Or Date if you parse it
  updatedAt: string; // Or Date if you parse it
  movies: Movie[];
}
