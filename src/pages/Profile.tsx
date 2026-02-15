import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserCollectionsApi, updateUserPreferencesApi, fetchRecommendationCollectionsApi, setRecommendationCollectionsApi } from '@/lib/api';
import { UserCollectionsResponse, UpdateUserPreferencesInput, RecommendationCollectionsResponse } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Calendar, Sparkles, FolderHeart, Loader2, X, ChevronDown } from 'lucide-react';
import { toast } from "sonner";

const COLLECTIONS_QUERY_KEY = ['collections', 'user'];
const USER_QUERY_KEY = ['user'];
const RECOMMENDATION_COLLECTIONS_QUERY_KEY = ['recommendations', 'collections'];

const Profile = () => {
    const queryClient = useQueryClient();
    const { user, isLoadingUser } = useAuth();

    // Fetch user's collections for the recommendation source selector
    const {
        data: collectionsData,
        isLoading: isLoadingCollections,
    } = useQuery<UserCollectionsResponse, Error>({
        queryKey: COLLECTIONS_QUERY_KEY,
        queryFn: fetchUserCollectionsApi,
        enabled: !!user,
    });

    // Fetch user's selected recommendation collections
    const {
        data: recommendationCollectionsData,
        isLoading: isLoadingRecommendationCollections,
    } = useQuery<RecommendationCollectionsResponse, Error>({
        queryKey: RECOMMENDATION_COLLECTIONS_QUERY_KEY,
        queryFn: fetchRecommendationCollectionsApi,
        enabled: !!user && (user.recommendations_enabled ?? false),
    });

    // Mutation for updating preferences
    const updatePreferencesMutation = useMutation({
        mutationFn: updateUserPreferencesApi,
        onSuccess: (data) => {
            // Update the user data in the cache
            queryClient.setQueryData(USER_QUERY_KEY, (oldData: { user: typeof user } | undefined) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    user: {
                        ...oldData.user,
                        recommendations_enabled: data.preferences.recommendations_enabled,
                        recommendations_collection_id: data.preferences.recommendations_collection_id,
                    }
                };
            });
            toast.success('Preferences updated');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update preferences: ${error.message}`);
        }
    });

    // Mutation for updating recommendation collections
    const setRecommendationCollectionsMutation = useMutation({
        mutationFn: setRecommendationCollectionsApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: RECOMMENDATION_COLLECTIONS_QUERY_KEY });
            toast.success('Source collections updated');
        },
        onError: (error: Error) => {
            toast.error(`Failed to update collections: ${error.message}`);
        }
    });

    const handleToggleRecommendations = (enabled: boolean) => {
        const updateData: UpdateUserPreferencesInput = {
            recommendations_enabled: enabled,
        };
        // If disabling, also clear the collection
        if (!enabled) {
            updateData.recommendations_collection_id = null;
        }
        updatePreferencesMutation.mutate(updateData);
        
        // If enabling, refetch recommendation collections
        if (enabled) {
            queryClient.invalidateQueries({ queryKey: RECOMMENDATION_COLLECTIONS_QUERY_KEY });
        }
    };

    const handleCollectionToggle = (collectionId: string, isChecked: boolean) => {
        const currentIds = recommendationCollectionsData?.collections.map(c => c.id) || [];
        let newIds: string[];
        
        if (isChecked) {
            newIds = [...currentIds, collectionId];
        } else {
            newIds = currentIds.filter(id => id !== collectionId);
        }
        
        setRecommendationCollectionsMutation.mutate(newIds);
    };

    const handleRemoveCollection = (collectionId: string) => {
        const currentIds = recommendationCollectionsData?.collections.map(c => c.id) || [];
        const newIds = currentIds.filter(id => id !== collectionId);
        setRecommendationCollectionsMutation.mutate(newIds);
    };

    const formatDate = (dateString: string | Date | undefined) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (isLoadingUser) {
        return (
            <>
                <Navbar />
                <main className="container py-8 max-w-2xl mx-auto">
                    <div className="space-y-6">
                        <Skeleton className="h-32 w-full rounded-xl" />
                        <Skeleton className="h-48 w-full rounded-xl" />
                    </div>
                </main>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <Navbar />
                <main className="container py-8 max-w-2xl mx-auto">
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">Please log in to view your profile.</p>
                    </div>
                </main>
            </>
        );
    }

    const recommendationsEnabled = user.recommendations_enabled ?? false;
    const selectedCollectionIds = new Set(recommendationCollectionsData?.collections.map(c => c.id) || []);
    const isLoading = isLoadingCollections || isLoadingRecommendationCollections;
    const isMutating = updatePreferencesMutation.isPending || setRecommendationCollectionsMutation.isPending;

    return (
        <>
            <Navbar />
            <main className="container py-8 max-w-2xl mx-auto px-4">
                <h1 className="text-3xl font-bold mb-8">Profile</h1>

                {/* User Info Card */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                            <Avatar className="h-20 w-20 shrink-0">
                                <AvatarImage
                                    src={user.avatar_url || user.avatarUrl || undefined}
                                    alt={user.username || 'User'}
                                />
                                <AvatarFallback className="text-lg">
                                    {getInitials(user.username)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left w-full">
                                <h2 className="text-2xl font-semibold">
                                    {user.username || 'User'}
                                </h2>
                                <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{user.email || 'No email'}</span>
                                </div>
                                {user.createdAt && (
                                    <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground text-sm">
                                        <Calendar className="h-4 w-4 shrink-0" />
                                        <span>Joined {formatDate(user.createdAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recommendations Settings Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Recommendations
                            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                Beta
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Get personalized movie and TV show recommendations based on your collections.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Enable Recommendations Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="recommendations-toggle" className="text-base">
                                    Enable Recommendations
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Receive personalized suggestions based on your taste
                                </p>
                            </div>
                            <Switch
                                id="recommendations-toggle"
                                checked={recommendationsEnabled}
                                onCheckedChange={handleToggleRecommendations}
                                disabled={isMutating}
                            />
                        </div>

                        {recommendationsEnabled && (
                            <>
                                <Separator />

                                {/* Collection Multi-Select Dropdown */}
                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-base flex items-center gap-2">
                                            <FolderHeart className="h-4 w-4" />
                                            Source Collections
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Select one or more collections to base your recommendations on
                                        </p>
                                    </div>

                                    {isLoading ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : collectionsData?.collections.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4">
                                            You don't have any collections yet. Create one to enable personalized recommendations.
                                        </p>
                                    ) : (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full justify-between h-auto min-h-10 py-2"
                                                    disabled={isMutating}
                                                >
                                                    <span className="flex flex-wrap gap-1 text-left">
                                                        {selectedCollectionIds.size === 0 ? (
                                                            <span className="text-muted-foreground">Select collections...</span>
                                                        ) : (
                                                            <span className="text-sm">
                                                                {selectedCollectionIds.size} collection{selectedCollectionIds.size !== 1 ? 's' : ''} selected
                                                            </span>
                                                        )}
                                                    </span>
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                                <div className="max-h-64 overflow-y-auto p-2">
                                                    {collectionsData?.collections.map((collection) => {
                                                        const isSelected = selectedCollectionIds.has(collection.id);
                                                        return (
                                                            <div
                                                                key={collection.id}
                                                                className="flex items-center space-x-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                                                                onClick={() => handleCollectionToggle(collection.id, !isSelected)}
                                                            >
                                                                <Checkbox
                                                                    id={`collection-${collection.id}`}
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) =>
                                                                        handleCollectionToggle(collection.id, checked === true)
                                                                    }
                                                                    disabled={isMutating}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                <label
                                                                    htmlFor={`collection-${collection.id}`}
                                                                    className="flex-1 text-sm font-medium cursor-pointer select-none"
                                                                >
                                                                    {collection.name}
                                                                </label>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}

                                    {/* Selected Collections Display */}
                                    {selectedCollectionIds.size > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {recommendationCollectionsData?.collections.map((collection) => (
                                                <Badge
                                                    key={collection.id}
                                                    variant="secondary"
                                                    className="flex items-center gap-1 pr-1"
                                                >
                                                    {collection.name}
                                                    <button
                                                        onClick={() => handleRemoveCollection(collection.id)}
                                                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                                                        disabled={isMutating}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {isMutating && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </>
    );
};

export default Profile;
