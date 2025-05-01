// --- Backend User Type (matches Lucia attributes) ---
export interface DatabaseUserAttributes {
    id: string;
    username: string | null;
    email: string | null;
    avatar_url: string | null;
    created_at: Date;
    updated_at: Date;
}

// --- Backend Collection Types (Subset needed for backend operations/responses) ---

// Basic Collection Info (used in lists/summaries)
export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string; // ISO string from DB
  updated_at: string; // ISO string from DB
  owner_username?: string | null; // Optional: added via join
  owner_avatar?: string | null;   // Optional: added via join
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
  username?: string | null;  // Optional: added via join
  email?: string | null;     // Optional: added via join
  avatar_url?: string | null; // Optional: added via join
}

// Define CollectionRow type used internally in controller
export interface CollectionRow {
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    created_at: string; 
    updated_at: string; 
}

// Define GoogleUser type used internally in controller
export interface GoogleUser {
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
    email_verified?: boolean;
    locale?: string;
}
