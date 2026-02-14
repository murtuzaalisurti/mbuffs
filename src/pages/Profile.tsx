import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserCollectionsApi, updateUserPreferencesApi } from '@/lib/api';
import { UserCollectionsResponse, UpdateUserPreferencesInput } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { User, Mail, Calendar, Sparkles, FolderHeart, Loader2 } from 'lucide-react';
import { toast } from "sonner";

const COLLECTIONS_QUERY_KEY = ['collections', 'user'];
const USER_QUERY_KEY = ['user'];

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

    const handleToggleRecommendations = (enabled: boolean) => {
        const updateData: UpdateUserPreferencesInput = {
            recommendations_enabled: enabled,
        };
        // If disabling, also clear the collection
        if (!enabled) {
            updateData.recommendations_collection_id = null;
        }
        updatePreferencesMutation.mutate(updateData);
    };

    const handleCollectionChange = (collectionId: string) => {
        const value = collectionId === 'none' ? null : collectionId;
        updatePreferencesMutation.mutate({
            recommendations_collection_id: value,
        });
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
    const selectedCollectionId = user.recommendations_collection_id ?? 'none';

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
                                disabled={updatePreferencesMutation.isPending}
                            />
                        </div>

                        {recommendationsEnabled && (
                            <>
                                <Separator />

                                {/* Collection Selector */}
                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="collection-select" className="text-base flex items-center gap-2">
                                            <FolderHeart className="h-4 w-4" />
                                            Source Collection
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Choose a collection to base your recommendations on
                                        </p>
                                    </div>

                                    {isLoadingCollections ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : (
                                        <Select
                                            value={selectedCollectionId}
                                            onValueChange={handleCollectionChange}
                                            disabled={updatePreferencesMutation.isPending}
                                        >
                                            <SelectTrigger id="collection-select" className="w-full">
                                                <SelectValue placeholder="Select a collection" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    <span className="text-muted-foreground">No collection selected</span>
                                                </SelectItem>
                                                {collectionsData?.collections.map((collection) => (
                                                    <SelectItem key={collection.id} value={collection.id}>
                                                        {collection.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {collectionsData?.collections.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            You don't have any collections yet. Create one to enable personalized recommendations.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        {updatePreferencesMutation.isPending && (
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
