import { z } from 'zod';

// --- Existing Auth Schemas (if any - remove if only using OAuth) ---
/*
export const registerSchema = z.object({ ... });
export const loginSchema = z.object({ ... });
*/

// --- Collection Schemas ---

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name cannot be empty").max(255),
  description: z.string().max(1000).optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name cannot be empty").max(255).optional(),
  description: z.string().max(1000).optional().nullable(), // Allow explicitly setting description to null
});

export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

export const addMovieSchema = z.object({
  movieId: z.number().int().positive("Invalid Movie ID"),
  // Optional: could include title/poster directly if desired
  // title: z.string().optional(),
  // posterPath: z.string().optional(),
});

export type AddMovieInput = z.infer<typeof addMovieSchema>;

export const addCollaboratorSchema = z.object({
  email: z.string().email("Invalid email address"),
  permission: z.enum(['view', 'edit']).default('edit'), // Default to edit for simplicity
});

export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;

export const updateCollaboratorSchema = z.object({
  permission: z.enum(['view', 'edit']),
});

export type UpdateCollaboratorInput = z.infer<typeof updateCollaboratorSchema>;

// --- Movie Schemas ---

export const searchMovieSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
});
export type SearchMovieInput = z.infer<typeof searchMovieSchema>;
