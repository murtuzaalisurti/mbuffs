import { pgTable, index, foreignKey, unique, text, varchar, timestamp, boolean, primaryKey, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const migrationsIdSeq = pgSequence("_migrations_id_seq", { startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })

// ============================================================================
// USER TABLE
// Note: Foreign key to collections.id for recommendations_collection_id exists in DB
// but is omitted here to avoid circular reference issues. See relations.ts for the relationship.
// ============================================================================
export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	username: text(),
	email: text(),
	hashedPassword: text("hashed_password"),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	recommendationsEnabled: boolean("recommendations_enabled").default(false),
	recommendationsCollectionId: text("recommendations_collection_id"),
}, (table) => [
	index("idx_user_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("user_username_key").on(table.username),
	unique("user_email_key").on(table.email),
]);

// ============================================================================
// SESSION TABLE
// ============================================================================
export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [user.id],
		name: "session_user_id_fkey"
	}).onDelete("cascade"),
]);

// ============================================================================
// OAUTH ACCOUNT TABLE
// ============================================================================
export const oauthAccount = pgTable("oauth_account", {
	providerId: text("provider_id").notNull(),
	providerUserId: text("provider_user_id").notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [user.id],
		name: "oauth_account_user_id_fkey"
	}).onDelete("cascade"),
	primaryKey({ columns: [table.providerId, table.providerUserId], name: "oauth_account_pkey" }),
]);

// ============================================================================
// COLLECTIONS TABLE
// ============================================================================
export const collections = pgTable("collections", {
	id: text().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	ownerId: text("owner_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	shareableId: text("shareable_id"),
}, (table) => [
	index("collections_owner_id_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	index("idx_collections_owner_id").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.ownerId],
		foreignColumns: [user.id],
		name: "collections_owner_id_fkey"
	}).onDelete("cascade"),
	unique("collections_shareable_id_key").on(table.shareableId),
]);

// ============================================================================
// COLLECTION COLLABORATORS TABLE
// ============================================================================
export const collectionCollaborators = pgTable("collection_collaborators", {
	id: text().primaryKey().notNull(),
	collectionId: text("collection_id").notNull(),
	userId: text("user_id").notNull(),
	permission: text().default('view').notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("collection_collaborators_collection_id_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("collection_collaborators_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_collection_collaborators_collection_id").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("idx_collection_collaborators_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.collectionId],
		foreignColumns: [collections.id],
		name: "collection_collaborators_collection_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [user.id],
		name: "collection_collaborators_user_id_fkey"
	}).onDelete("cascade"),
	unique("collection_collaborators_collection_id_user_id_key").on(table.collectionId, table.userId),
]);

// ============================================================================
// COLLECTION MOVIES TABLE
// ============================================================================
export const collectionMovies = pgTable("collection_movies", {
	id: text().primaryKey().notNull(),
	collectionId: text("collection_id").notNull(),
	movieId: varchar("movie_id").notNull(),
	addedByUserId: text("added_by_user_id").notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	isMovie: boolean("is_movie"),
}, (table) => [
	index("collection_movies_collection_id_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("idx_collection_movies_collection_id").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("idx_collection_movies_movie_id").using("btree", table.movieId.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.addedByUserId],
		foreignColumns: [user.id],
		name: "collection_movies_added_by_user_id_fkey"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.collectionId],
		foreignColumns: [collections.id],
		name: "collection_movies_collection_id_fkey"
	}).onDelete("cascade"),
	unique("collection_movies_collection_id_movie_id_key").on(table.collectionId, table.movieId),
]);
