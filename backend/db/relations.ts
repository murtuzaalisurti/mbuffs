import { relations } from "drizzle-orm/relations";
import { user, collections, collectionCollaborators, collectionMovies, session, oauthAccount, userRecommendationCollections } from "./schema";

export const collectionsRelations = relations(collections, ({one, many}) => ({
	user: one(user, {
		fields: [collections.ownerId],
		references: [user.id],
		relationName: "collections_ownerId_user_id"
	}),
	collectionCollaborators: many(collectionCollaborators),
	collectionMovies: many(collectionMovies),
	users: many(user, {
		relationName: "user_recommendationsCollectionId_collections_id"
	}),
	userRecommendationCollections: many(userRecommendationCollections),
}));

export const userRelations = relations(user, ({one, many}) => ({
	collections: many(collections, {
		relationName: "collections_ownerId_user_id"
	}),
	collectionCollaborators: many(collectionCollaborators),
	collectionMovies: many(collectionMovies),
	sessions: many(session),
	collection: one(collections, {
		fields: [user.recommendationsCollectionId],
		references: [collections.id],
		relationName: "user_recommendationsCollectionId_collections_id"
	}),
	oauthAccounts: many(oauthAccount),
	recommendationCollections: many(userRecommendationCollections),
}));

export const collectionCollaboratorsRelations = relations(collectionCollaborators, ({one}) => ({
	collection: one(collections, {
		fields: [collectionCollaborators.collectionId],
		references: [collections.id]
	}),
	user: one(user, {
		fields: [collectionCollaborators.userId],
		references: [user.id]
	}),
}));

export const collectionMoviesRelations = relations(collectionMovies, ({one}) => ({
	user: one(user, {
		fields: [collectionMovies.addedByUserId],
		references: [user.id]
	}),
	collection: one(collections, {
		fields: [collectionMovies.collectionId],
		references: [collections.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const oauthAccountRelations = relations(oauthAccount, ({one}) => ({
	user: one(user, {
		fields: [oauthAccount.userId],
		references: [user.id]
	}),
}));

export const userRecommendationCollectionsRelations = relations(userRecommendationCollections, ({one}) => ({
	user: one(user, {
		fields: [userRecommendationCollections.userId],
		references: [user.id]
	}),
	collection: one(collections, {
		fields: [userRecommendationCollections.collectionId],
		references: [collections.id]
	}),
}));