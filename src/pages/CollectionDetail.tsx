import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
    fetchCollectionDetailsApi,
    fetchMovieDetailsApi,
    searchMoviesApi,
    addMovieToCollectionApi,
    removeMovieFromCollectionApi,
    addCollaboratorApi,
    removeCollaboratorApi,
    fetchTvDetailsApi
} from '@/lib/api';
import { CollectionDetails, MovieDetails, CollectionCollaborator, AddCollaboratorInput, SearchResults, AddMovieInput } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MovieCard } from "@/components/MovieCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getImageUrl } from "@/lib/api";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Film, Trash2, UserPlus, Loader2, Check, UserMinus, Plus, Search as SearchIcon, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useMemo, Fragment } from 'react';
import { toast } from "sonner";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const frontendAddCollaboratorSchema = z.object({
    email: z.string().email("Invalid email address"),
});
type FrontendAddCollaboratorInput = z.infer<typeof frontendAddCollaboratorSchema>;

const ITEMS_PER_PAGE = 30;

const CollectionDetail = () => {
    const { collectionId } = useParams<{ collectionId: string }>();
    const { user: currentUser, isLoggedIn } = useAuth();
    const queryClient = useQueryClient();
    const [isAddCollabOpen, setIsAddCollabOpen] = useState(false);
    const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
    const [isCollabListOpen, setIsCollabListOpen] = useState(false);
    const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
    const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);

    const collectionQueryKey = ['collection', collectionId];

    const {
        data: collectionDetails,
        isLoading: isLoadingCollection,
        isError: isCollectionError,
        error: collectionError
    } = useQuery<CollectionDetails, Error>({
        queryKey: collectionQueryKey,
        queryFn: () => fetchCollectionDetailsApi(collectionId!),
        enabled: !!collectionId && isLoggedIn,
    });

    const movieIds = collectionDetails?.movies.map(m => m.movie_id) ?? [];
    const {
        data: moviesDetailsMap,
        isLoading: isLoadingMovies
    } = useQuery<Record<number, MovieDetails | null>, Error>({
        queryKey: ['movies', 'details', ...movieIds].sort(),
        queryFn: async () => {
            if (!movieIds || movieIds.length === 0) return {};
            const promises = movieIds.map((id) => {
                const idStr = String(id);
                if (idStr.includes('tv')) {
                    const numericId = parseInt(idStr.replace('tv', ''), 10);
                    return fetchTvDetailsApi(numericId);
                } else {
                    return fetchMovieDetailsApi(Number(id));
                }
            });
            const results = await Promise.all(promises);
            const map: Record<number, MovieDetails | null> = {};
            movieIds.forEach((id, index) => { map[id] = results[index]; });
            return map;
        },
        enabled: movieIds.length > 0,
        staleTime: 1000 * 60 * 60,
    });

    const filteredMedia = useMemo(() => {
        if (!collectionDetails || !moviesDetailsMap) return [];
        return collectionDetails.movies.filter(entry => {
            const media = moviesDetailsMap[entry.movie_id];
            if (!media) return false;
            switch (mediaTypeFilter) {
                case 'movie':
                    return 'release_date' in media && media.release_date !== undefined;
                case 'tv':
                    return 'first_air_date' in media && media.first_air_date !== undefined;
                case 'all':
                default:
                    return true;
            }
        });
    }, [collectionDetails, moviesDetailsMap, mediaTypeFilter]);

    const currentVisibleMedia = useMemo(() => {
        return filteredMedia.slice(0, visibleItemsCount);
    }, [filteredMedia, visibleItemsCount]);

    // Mutations
    const removeMovieMutation = useMutation<void, Error, { collectionId: string; movieId: number | string }>({
        mutationFn: ({ collectionId, movieId }) => removeMovieFromCollectionApi(collectionId, movieId),
        onSuccess: (_, { movieId }) => {
            toast.success("Removed from collection.");
            queryClient.invalidateQueries({ queryKey: collectionQueryKey });
            queryClient.invalidateQueries({ queryKey: ['collections', 'movie-status', String(movieId)] });
        },
        onError: (error) => { toast.error(`Failed to remove: ${error.message}`); }
    });

    const { register: registerCollab, handleSubmit: handleSubmitCollab, reset: resetCollab, formState: { errors: collabErrors } } = useForm<FrontendAddCollaboratorInput>({
        resolver: zodResolver(frontendAddCollaboratorSchema),
    });
    
    const addCollaboratorMutation = useMutation<{ collaborator: CollectionCollaborator }, Error, { collectionId: string; data: AddCollaboratorInput }>({
        mutationFn: ({ collectionId, data }) => addCollaboratorApi(collectionId, data),
        onSuccess: (data) => {
            toast.success(`${data.collaborator.username || data.collaborator.email} added.`);
            queryClient.invalidateQueries({ queryKey: collectionQueryKey });
            resetCollab();
            setIsAddCollabOpen(false);
        },
        onError: (error) => { toast.error(`Failed to add: ${error.message}`); }
    });
    
    const onAddCollaborator = (formData: FrontendAddCollaboratorInput) => {
        if (!collectionId) return;
        addCollaboratorMutation.mutate({ collectionId, data: { email: formData.email, permission: 'edit' } });
    };

    const removeCollaboratorMutation = useMutation<void, Error, { collectionId: string; userId: string }>({
        mutationFn: ({ collectionId, userId }) => removeCollaboratorApi(collectionId, userId),
        onSuccess: () => {
            toast.success("Collaborator removed.");
            queryClient.invalidateQueries({ queryKey: collectionQueryKey });
        },
        onError: (error) => { toast.error(`Failed to remove: ${error.message}`); }
    });

    const addMovieMutation = useMutation<any, Error, { collectionId: string; data: AddMovieInput }>({
        mutationFn: ({ collectionId, data }) => addMovieToCollectionApi(collectionId, data),
        onSuccess: (data, variables) => {
            toast.success(`Added to collection.`);
            queryClient.invalidateQueries({ queryKey: collectionQueryKey });
            queryClient.invalidateQueries({ queryKey: ['collections', 'movie-status', String(variables.data.movieId)] });
        },
        onError: (error: any) => {
            if (error?.data?.message?.includes('already exists')) {
                toast.warning("Already in this collection.");
            } else {
                toast.error(`Failed to add: ${error.message}`);
            }
        }
    });

    const collection = collectionDetails?.collection;
    const isOwner = collection?.owner_id === currentUser?.id;
    const canEdit = isOwner || collectionDetails?.collaborators.some(c => c.user_id === currentUser?.id && c.permission === 'edit');

    const isLoading = isLoadingCollection;
    const isError = isCollectionError;
    const error = collectionError;

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="container py-10 max-w-6xl mx-auto">
                    <Skeleton className="h-10 w-1/3 mb-2" />
                    <Skeleton className="h-5 w-1/2 mb-8" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
                        ))}
                    </div>
                </main>
            </>
        );
    }

    if (isError) {
        return (
            <>
                <Navbar />
                <main className="container py-10 max-w-6xl mx-auto text-center">
                    <p className="text-destructive">Error: {error?.message ?? 'Unknown error'}</p>
                </main>
            </>
        );
    }

    if (!collection) {
        return (
            <>
                <Navbar />
                <main className="container py-10 max-w-6xl mx-auto text-center">
                    <p className="text-muted-foreground">Collection not found or you don't have permission to view it.</p>
                </main>
            </>
        );
    }

    const getInitials = (name?: string | null): string => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '';
    }

    const totalCollaborators = collectionDetails.collaborators.length + 1;

    return (
        <>
            <Navbar />
            <main className="container py-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-4xl font-semibold tracking-tight mb-2">{collection.name}</h1>
                    {collection.description && (
                        <p className="text-muted-foreground text-lg mb-4 max-w-2xl">{collection.description}</p>
                    )}
                    
                    {/* Owner & Collaborators Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={collection.owner_avatar} />
                                <AvatarFallback className="text-xs">{getInitials(collection.owner_username)}</AvatarFallback>
                            </Avatar>
                            <span>{collection.owner_username}</span>
                        </div>
                        
                        <span className="text-muted-foreground/30">|</span>
                        
                        {/* Collaborators */}
                        <Dialog open={isCollabListOpen} onOpenChange={setIsCollabListOpen}>
                            <DialogTrigger asChild>
                                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <div className="flex -space-x-2">
                                        <Avatar className="h-6 w-6 border-2 border-background">
                                            <AvatarImage src={collection.owner_avatar} />
                                            <AvatarFallback className="text-xs">{getInitials(collection.owner_username)}</AvatarFallback>
                                        </Avatar>
                                        {collectionDetails.collaborators.slice(0, 2).map((c) => (
                                            <Avatar key={c.user_id} className="h-6 w-6 border-2 border-background">
                                                <AvatarImage src={c.avatar_url} />
                                                <AvatarFallback className="text-xs">{getInitials(c.username)}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {collectionDetails.collaborators.length > 2 && (
                                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                                                +{collectionDetails.collaborators.length - 2}
                                            </div>
                                        )}
                                    </div>
                                    <span>{totalCollaborators} {totalCollaborators === 1 ? 'member' : 'members'}</span>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="w-[90%] sm:max-w-[400px] rounded-xl">
                                <DialogHeader>
                                    <DialogTitle>Members</DialogTitle>
                                    <DialogDescription>People who can access this collection.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[300px]">
                                    <div className="space-y-1 py-2">
                                        {/* Owner */}
                                        <div className="flex items-center justify-between gap-3 p-2 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={collection.owner_avatar} />
                                                    <AvatarFallback>{getInitials(collection.owner_username)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{collection.owner_username ?? 'Owner'}</p>
                                                    <p className="text-xs text-muted-foreground">Owner</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Collaborators */}
                                        {collectionDetails.collaborators.map((c) => (
                                            <div key={c.user_id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={c.avatar_url} />
                                                        <AvatarFallback>{getInitials(c.username)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">{c.username ?? c.email}</p>
                                                        <p className="text-xs text-muted-foreground capitalize">{c.permission}</p>
                                                    </div>
                                                </div>
                                                {isOwner && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                                {(removeCollaboratorMutation.isPending && removeCollaboratorMutation.variables?.userId === c.user_id) 
                                                                    ? <Loader2 className="h-4 w-4 animate-spin" /> 
                                                                    : <UserMinus className="h-4 w-4" />}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="w-[90%] sm:max-w-[400px] rounded-xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                                                <AlertDialogDescription>Remove {c.username ?? c.email} from this collection?</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    onClick={() => removeCollaboratorMutation.mutate({ collectionId: collectionId!, userId: c.user_id })} 
                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                >
                                                                    Remove
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <DialogFooter className="flex-row gap-2 sm:justify-between">
                                    {isOwner && (
                                        <Dialog open={isAddCollabOpen} onOpenChange={setIsAddCollabOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-1.5">
                                                    <UserPlus className="h-4 w-4" />
                                                    Add
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="w-[90%] sm:max-w-[400px] rounded-xl">
                                                <form onSubmit={handleSubmitCollab(onAddCollaborator)}>
                                                    <DialogHeader>
                                                        <DialogTitle>Add Member</DialogTitle>
                                                        <DialogDescription>Invite someone by email.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="collab-email">Email</Label>
                                                            <Input 
                                                                id="collab-email" 
                                                                type="email" 
                                                                placeholder="name@example.com"
                                                                {...registerCollab("email")} 
                                                                aria-invalid={collabErrors.email ? "true" : "false"} 
                                                            />
                                                            {collabErrors.email && <p className="text-destructive text-sm">{collabErrors.email.message}</p>}
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button type="submit" disabled={addCollaboratorMutation.isPending}>
                                                            {addCollaboratorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                                                            Add Member
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                    <DialogClose asChild>
                                        <Button variant="ghost" size="sm">Done</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Tabs value={mediaTypeFilter} onValueChange={(value) => {
                            setMediaTypeFilter(value);
                            setVisibleItemsCount(ITEMS_PER_PAGE);
                        }}>
                            <TabsList className="h-9">
                                <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                                <TabsTrigger value="movie" className="text-xs px-3">Movies</TabsTrigger>
                                <TabsTrigger value="tv" className="text-xs px-3">TV</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <span className="text-sm text-muted-foreground">{filteredMedia.length} items</span>
                    </div>
                    
                    {canEdit && (
                        <Dialog open={isAddMovieOpen} onOpenChange={setIsAddMovieOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-1.5">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add</span>
                                </Button>
                            </DialogTrigger>
                            <AddMovieDialog
                                collectionId={collectionId!}
                                existingMovieIds={movieIds as unknown as string[]}
                                onAddMovie={(movieId) => addMovieMutation.mutate({ collectionId: collectionId!, data: { movieId: movieId as unknown as number } })}
                                isAddingMovie={addMovieMutation.isPending}
                            />
                        </Dialog>
                    )}
                </div>

                {/* Grid */}
                {isLoadingMovies ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {Array.from({ length: collectionDetails.movies.length || 12 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
                        ))}
                    </div>
                ) : currentVisibleMedia.length > 0 ? (
                    <Fragment>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {currentVisibleMedia.map(movieEntry => {
                                const movie = moviesDetailsMap?.[movieEntry.movie_id];
                                if (!movie) return (
                                    <div key={movieEntry.movie_id} className="relative group">
                                        <Skeleton className="aspect-[2/3] rounded-lg" />
                                    </div>
                                );
                                return (
                                    <div key={movieEntry.movie_id} className="relative group">
                                        <MovieCard movie={movie} />
                                        {canEdit && (
                                            <div className="absolute top-2 right-2 z-10">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button 
                                                            variant="secondary" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm border-0 hover:bg-black/80 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        >
                                                            <MoreVertical className="h-4 w-4 text-white" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-36">
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                            disabled={removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movieEntry.movie_id}
                                                            onClick={() => removeMovieMutation.mutate({ collectionId: collectionId!, movieId: movieEntry.movie_id })}
                                                        >
                                                            {(removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movieEntry.movie_id) 
                                                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                                                                : <Trash2 className="mr-2 h-4 w-4" />}
                                                            Remove
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {filteredMedia.length > visibleItemsCount && (
                            <div className="text-center mt-10">
                                <Button
                                    variant="outline"
                                    onClick={() => setVisibleItemsCount(prevCount => prevCount + ITEMS_PER_PAGE)}
                                >
                                    Load More ({filteredMedia.length - visibleItemsCount} remaining)
                                </Button>
                            </div>
                        )}
                    </Fragment>
                ) : (
                    <div className="text-center py-20">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                            <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-1">
                            {mediaTypeFilter === 'all' ? 'No items yet' : `No ${mediaTypeFilter === 'movie' ? 'movies' : 'TV shows'}`}
                        </h3>
                        <p className="text-muted-foreground">
                            {mediaTypeFilter === 'all' 
                                ? 'Add movies and shows to this collection.' 
                                : 'Try a different filter.'}
                        </p>
                    </div>
                )}
            </main>
        </>
    );
};


// --- Add Movie Dialog Component ---
interface AddMovieDialogProps {
    collectionId: string;
    existingMovieIds: string[];
    onAddMovie: (movieId: string) => void;
    isAddingMovie: boolean;
}

const AddMovieDialog: React.FC<AddMovieDialogProps> = ({ collectionId, existingMovieIds, onAddMovie, isAddingMovie }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [selectedMovieId, setSelectedMovieId] = useState<number | string | null>(null);

    const {
        data: searchResultsData,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isLoading: isLoadingSearch,
        isError: isSearchError,
        error: searchError
    } = useInfiniteQuery<SearchResults, Error>({
        queryKey: ['movies', 'search', debouncedSearchTerm],
        queryFn: ({ pageParam = 1 }) => searchMoviesApi(debouncedSearchTerm, pageParam as number),
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.total_pages) { return lastPage.page + 1; }
            return undefined;
        },
        enabled: !!debouncedSearchTerm,
        initialPageParam: 1,
    });

    const handleAddClick = (movieId: string) => {
        setSelectedMovieId(movieId);
        onAddMovie(movieId);
    };

    const movies = searchResultsData?.pages.flatMap(page => page.results) ?? [];

    return (
        <DialogContent className="w-[90%] sm:max-w-[550px] rounded-xl">
            <DialogHeader>
                <DialogTitle>Add to Collection</DialogTitle>
                <DialogDescription>Search for movies and TV shows.</DialogDescription>
            </DialogHeader>
            
            <div className="relative my-2">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Search..." 
                    className="pl-9" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
                {isFetching && !isFetchingNextPage && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>
            
            <ScrollArea className="h-[350px] -mx-6 px-6">
                <div className="space-y-1">
                    {isLoadingSearch && debouncedSearchTerm && (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    )}
                    {isSearchError && (
                        <div className="text-destructive text-center py-8">Error: {searchError?.message}</div>
                    )}
                    {!debouncedSearchTerm && (
                        <div className="text-muted-foreground text-center py-8">Start typing to search...</div>
                    )}
                    {debouncedSearchTerm && !isLoadingSearch && !isSearchError && movies.length === 0 && (
                        <div className="text-muted-foreground text-center py-8">No results for "{debouncedSearchTerm}"</div>
                    )}
                    
                    {movies.map((movie, i) => {
                        const movieId = Object.keys(movie).includes('first_air_date') ? (String(movie.id) + 'tv') : movie.id;
                        const alreadyAdded = existingMovieIds.map(m => m).includes(movieId as string);
                        const isCurrentMovieAdding = isAddingMovie && selectedMovieId === movieId;
                        
                        return (
                            <div 
                                key={movie.id + i} 
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <img 
                                    src={getImageUrl(movie.poster_path, 'w92')} 
                                    alt={movie.name || movie.title} 
                                    className="h-14 w-auto rounded aspect-[2/3] object-cover bg-muted" 
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} 
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{movie.name || movie.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {(movie.first_air_date || movie.release_date)?.substring(0, 4)}
                                    </p>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant={alreadyAdded ? "secondary" : "default"} 
                                    onClick={() => handleAddClick(movieId as string)} 
                                    disabled={alreadyAdded || isCurrentMovieAdding || isAddingMovie}
                                    className="shrink-0"
                                >
                                    {isCurrentMovieAdding ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : alreadyAdded ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        );
                    })}
                    
                    {hasNextPage && (
                        <div className="pt-2">
                            <Button 
                                variant="ghost" 
                                className="w-full" 
                                onClick={() => fetchNextPage()} 
                                disabled={isFetchingNextPage}
                            >
                                {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
                                Load More
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Done</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
};

export default CollectionDetail;
