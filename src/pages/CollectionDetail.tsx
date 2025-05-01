
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
    fetchCollectionDetailsApi,
    fetchMovieDetailsApi, // To get details for movies in the collection
    searchMoviesApi, // For searching movies to add
    addMovieToCollectionApi, // To add the movie
    removeMovieFromCollectionApi,
    addCollaboratorApi,
    removeCollaboratorApi,
    deleteCollectionApi,
    updateCollectionApi
} from '@/lib/api';
import { CollectionDetails, MovieDetails, CollectionCollaborator, AddCollaboratorInput, UpdateCollectionInput, Movie, SearchResults, AddMovieInput } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MovieCard } from "@/components/MovieCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getImageUrl } from "@/lib/api";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Users, Film, Trash2, Edit, UserPlus, X, Loader2, Check, UserMinus, Copy, PlusCircle, Search as SearchIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from "sonner";
import { ScrollArea } from '@/components/ui/scroll-area'; // For scrollable search results
import { useDebounce } from '@/hooks/use-debounce'; // Import the actual hook

// **Important**: Copy/paste Zod schemas or share
const frontendAddCollaboratorSchema = z.object({
  email: z.string().email("Invalid email address"),
});
type FrontendAddCollaboratorInput = z.infer<typeof frontendAddCollaboratorSchema>;

const frontendUpdateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name cannot be empty").max(255),
  description: z.string().max(1000).optional().nullable(),
});
type FrontendUpdateCollectionInput = z.infer<typeof frontendUpdateCollectionSchema>;

// REMOVED the inline useDebounce definition

const CollectionDetail = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { user: currentUser, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddCollabOpen, setIsAddCollabOpen] = useState(false);
  const [isEditCollabOpen, setIsEditCollabOpen] = useState(false);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [isCollabListOpen, setIsCollabListOpen] = useState(false);

  const collectionQueryKey = ['collection', collectionId];

  // Fetch collection details
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

  // Fetch details for movies within the collection
  const movieIds = collectionDetails?.movies.map(m => m.movie_id) ?? [];
  const {
      data: moviesDetailsMap,
      isLoading: isLoadingMovies
  } = useQuery<Record<number, MovieDetails | null>, Error>({
        queryKey: ['movies', 'details', ...movieIds].sort(),
        queryFn: async () => {
            if (!movieIds || movieIds.length === 0) return {};
            const promises = movieIds.map(id => fetchMovieDetailsApi(id));
            const results = await Promise.all(promises);
            const map: Record<number, MovieDetails | null> = {};
            movieIds.forEach((id, index) => { map[id] = results[index]; });
            return map;
        },
        enabled: movieIds.length > 0,
        staleTime: 1000 * 60 * 60,
    });

  // --- Mutations ---

  // Delete Collection
  const deleteCollectionMutation = useMutation<void, Error, string>({
      mutationFn: deleteCollectionApi,
      onSuccess: () => {
          toast.success("Collection deleted successfully!");
          queryClient.invalidateQueries({ queryKey: ['collections', 'user'] });
          navigate('/collections');
      }, onError: (error) => { toast.error(`Failed to delete collection: ${error.message}`); }
  });

  // Remove Movie
  const removeMovieMutation = useMutation<void, Error, { collectionId: string; movieId: number }>({
      mutationFn: ({ collectionId, movieId }) => removeMovieFromCollectionApi(collectionId, movieId),
      onSuccess: () => {
          toast.success("Movie removed from collection.");
          queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      }, onError: (error) => { toast.error(`Failed to remove movie: ${error.message}`); }
  });

  // Add Collaborator
  const { register: registerCollab, handleSubmit: handleSubmitCollab, reset: resetCollab, formState: { errors: collabErrors } } = useForm<FrontendAddCollaboratorInput>({
      resolver: zodResolver(frontendAddCollaboratorSchema),
  });
  const addCollaboratorMutation = useMutation<{ collaborator: CollectionCollaborator }, Error, { collectionId: string; data: AddCollaboratorInput }>({
      mutationFn: ({ collectionId, data }) => addCollaboratorApi(collectionId, data),
      onSuccess: (data) => {
          toast.success(`Collaborator ${data.collaborator.username || data.collaborator.email} added.`);
          queryClient.invalidateQueries({ queryKey: collectionQueryKey });
          resetCollab(); setIsAddCollabOpen(false);
      }, onError: (error) => { toast.error(`Failed to add collaborator: ${error.message}`); }
  });
  const onAddCollaborator = (formData: FrontendAddCollaboratorInput) => {
      if (!collectionId) return;
      addCollaboratorMutation.mutate({ collectionId, data: { email: formData.email, permission: 'edit' } });
  };

  // Remove Collaborator
  const removeCollaboratorMutation = useMutation<void, Error, { collectionId: string; userId: string }>({
      mutationFn: ({ collectionId, userId }) => removeCollaboratorApi(collectionId, userId),
      onSuccess: () => {
          toast.success("Collaborator removed.");
          queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      }, onError: (error) => { toast.error(`Failed to remove collaborator: ${error.message}`); }
  });

  // Edit Collection
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, setValue: setEditValue, formState: { errors: editErrors } } = useForm<FrontendUpdateCollectionInput>({
      resolver: zodResolver(frontendUpdateCollectionSchema),
  });
  const editCollectionMutation = useMutation<{ collection: CollectionDetails }, Error, { collectionId: string; data: UpdateCollectionInput }>({
      // Ensure the mutation function returns the expected type
      mutationFn: async ({ collectionId, data }): Promise<{ collection: CollectionDetails }> => {
          // The API function might return CollectionSummary, but we need CollectionDetails here
          // It's safer to invalidate and let the main query refetch for full details
          await updateCollectionApi(collectionId, data);
          // Invalidate and refetch to get full details including collaborators/movies
          const updatedDetails = await queryClient.invalidateQueries({ queryKey: collectionQueryKey });
          // We might not get the data back immediately from invalidateQueries, 
          // rely on the main useQuery to update.
          // For optimistic updates, the structure must match exactly.
          // Here we prioritize consistency via refetch.
          return {} as { collection: CollectionDetails }; // Return dummy structure, real update via refetch
      },
      onSuccess: (data) => { // Data might be dummy structure here due to above
          toast.success("Collection updated.");
          // Rely on invalidation already called in mutationFn or call it here again
          // queryClient.invalidateQueries({ queryKey: collectionQueryKey }); 
          queryClient.invalidateQueries({ queryKey: ['collections', 'user'] }); // Invalidate list view
          setIsEditCollabOpen(false);
      }, onError: (error) => { toast.error(`Failed to update collection: ${error.message}`); }
  });
   const onEditCollection = (formData: FrontendUpdateCollectionInput) => {
      if (!collectionId) return;
      const dataToSend = { ...formData, description: formData.description || null };
      editCollectionMutation.mutate({ collectionId, data: dataToSend });
  };
   const handleEditCollectionOpen = () => {
     if (collectionDetails) {
        setEditValue("name", collectionDetails.collection.name);
        setEditValue("description", collectionDetails.collection.description ?? ''); // Handle null description
        setIsEditCollabOpen(true);
     }
   };

   // Add Movie Mutation
   const addMovieMutation = useMutation<any, Error, { collectionId: string; data: AddMovieInput }>({ // eslint-disable-line @typescript-eslint/no-explicit-any
       mutationFn: ({ collectionId, data }) => addMovieToCollectionApi(collectionId, data),
       onSuccess: (data, variables) => {
           toast.success(`Movie added to collection.`);
           queryClient.invalidateQueries({ queryKey: collectionQueryKey });
       },
       onError: (error: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (error?.data?.message?.includes('already exists')) {
                 toast.warning("Movie already exists in this collection.");
            } else {
                 toast.error(`Failed to add movie: ${error.message}`);
            }
       }
   });

  // --- Derived State & Permissions ---
  const collection = collectionDetails?.collection;
  console.log('Collection:', collection);
  const isOwner = collection?.owner_id === currentUser?.id;
  const canEdit = isOwner || collectionDetails?.collaborators.some(c => c.user_id === currentUser?.id && c.permission === 'edit');

  // --- Render Logic ---
  // Use optional chaining more carefully
  const isLoading = isLoadingCollection;
  const isError = isCollectionError;
  const error = collectionError;

  if (isLoading) {
      return (
          <>
              <Navbar />
              <main className="container py-8">
                  <Skeleton className="h-10 w-3/4 mb-4" />
                  <Skeleton className="h-6 w-1/2 mb-8" />
                  <Skeleton className="h-96 w-full" />
              </main>
          </>
      );
  }

  if (isError) {
      return (
          <>
              <Navbar />
              <main className="container py-8 text-red-500 text-center">
                  Error loading collection: {error?.message ?? 'Unknown error'}
              </main>
          </>
      );
  }

  if (!collection) {
      // This case might be covered by isLoading or isError, but good for safety
      return (
          <>
              <Navbar />
              <main className="container py-8 text-center">
                  Collection not found or you might not have permission to view it.
              </main>
          </>
      );
  }

  const getInitials = (name?: string | null): string => {
      return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '';
  }

  const copyInviteLink = () => {
      const link = `${window.location.origin}/collection/${collectionId}`; 
      navigator.clipboard.writeText(link).then(() => {
          toast.success("Collection link copied to clipboard!");
      }, (err) => {
          toast.error("Failed to copy link.");
          console.error('Could not copy text: ', err);
      });
  }

  return (
    <>
      <Navbar />
      <main className="container py-8">
        {/* Header Section */}
        <div className="mb-12">
            <div className="flex flex-row justify-between items-start gap-4 mb-2">
                <div className="flex-grow min-w-0">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        {collection.name} 
                        {canEdit && (
                            <Dialog open={isEditCollabOpen} onOpenChange={setIsEditCollabOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditCollectionOpen}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[90%] sm:max-w-[425px] rounded-lg">
                                    <form onSubmit={handleSubmitEdit(onEditCollection)}>
                                        <DialogHeader>
                                            <DialogTitle>Edit Collection</DialogTitle>
                                            <DialogDescription>Update name and description.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            {/* Name Input */}
                                            <div className="grid w-full items-center gap-1.5">
                                                <Label htmlFor="edit-name" className="text-sm text-muted-foreground">Name</Label>
                                                <Input id="edit-name" className="bg-muted" {...registerEdit("name")} aria-invalid={editErrors.name ? "true" : "false"} />
                                                {editErrors.name && <p className="text-red-500 text-sm">{editErrors.name.message}</p>}
                                            </div>
                                            {/* Description Input */}
                                            <div className="grid w-full items-center gap-1.5">
                                                <Label htmlFor="edit-description" className="text-sm text-muted-foreground">Description</Label>
                                                <Textarea id="edit-description" className="bg-muted" {...registerEdit("description")} aria-invalid={editErrors.description ? "true" : "false"} />
                                                {editErrors.description && <p className="text-red-500 text-sm">{editErrors.description.message}</p>}
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={editCollectionMutation.isPending}>
                                                {editCollectionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </h1>
                    {collection.description && (<p className="text-muted-foreground max-w-prose">{collection.description}</p>)}
                </div>
                 <div className="flex items-center gap-2 flex-shrink-0">
                    {isOwner && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={deleteCollectionMutation.isPending}>
                                    {deleteCollectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} 
                                    <span className="ml-2 hidden sm:inline">Delete</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[90%] sm:max-w-md rounded-lg">
                                {/* ... Delete Confirmation ... */}
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This action cannot be undone. This will permanently delete the collection "<strong>{collection.name}</strong>".</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteCollectionMutation.mutate(collectionId!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <Button variant="outline" size="sm" onClick={copyInviteLink}>
                        <Copy className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Copy Link</span>
                    </Button>
                 </div>
            </div>
             <div className="text-xs text-muted-foreground flex items-center gap-1">
                Owned by
                <Avatar className="h-5 w-5 inline-block mx-1">
                    <AvatarImage src={collection.owner_avatar} alt={collection.owner_username ?? 'Owner'} />
                    <AvatarFallback>{getInitials(collection.owner_username)}</AvatarFallback>
                </Avatar>
                {collection.owner_username ?? 'Unknown User'}
            </div>
        </div>

        {/* Collaborators Section */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold flex items-center"><Users className="mr-2 h-5 w-5"/> Collaborators ({collectionDetails.collaborators.length + 1})</h2>
                {isOwner && (
                    <Dialog open={isAddCollabOpen} onOpenChange={setIsAddCollabOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default" size="sm"><UserPlus className="h-4 w-4 sm:mr-2"/>
                                <span className="hidden sm:inline">
                                    Add Collaborator
                                </span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[90%] sm:max-w-[425px] rounded-lg">
                            <form onSubmit={handleSubmitCollab(onAddCollaborator)}>
                                {/* ... Add Collaborator Form ... */}
                                <DialogHeader>
                                    <DialogTitle>Add Collaborator</DialogTitle>
                                    <DialogDescription>Enter email to invite.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                     <div className="grid w-full items-center gap-1.5">
                                        <Label htmlFor="collab-email" className="text-sm text-muted-foreground">Email</Label>
                                        <Input id="collab-email" className="bg-muted" type="email" {...registerCollab("email")} aria-invalid={collabErrors.email ? "true" : "false"} />
                                        {collabErrors.email && <p className="text-red-500 text-sm">{collabErrors.email.message}</p>}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={addCollaboratorMutation.isPending}>{addCollaboratorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            {/* --- Avatar Stack and Management Dialog --- */}
            <Dialog open={isCollabListOpen} onOpenChange={setIsCollabListOpen}>
                <DialogTrigger asChild>
                    <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
                        {/* Owner Avatar */}
                        <Avatar className="h-8 w-8 border-2 border-background ring-1 ring-border">
                            <AvatarImage src={collection.owner_avatar} />
                            <AvatarFallback>{getInitials(collection.owner_username)}</AvatarFallback>
                        </Avatar>
                        {/* First few Collaborator Avatars */}
                        {collectionDetails.collaborators.slice(0, 3).map((c, index) => (
                            <Avatar key={c.user_id} className="-ml-3 h-8 w-8 border-2 border-background ring-1 ring-border">
                                <AvatarImage src={c.avatar_url} />
                                <AvatarFallback>{getInitials(c.username)}</AvatarFallback>
                            </Avatar>
                        ))}
                        {/* More Indicator */}
                        {collectionDetails.collaborators.length > 3 && (
                            <Avatar className="-ml-3 h-8 w-8 border-2 border-background ring-1 ring-border bg-muted">
                                <AvatarFallback>+{collectionDetails.collaborators.length - 3}</AvatarFallback>
                            </Avatar>
                        )}
                         {/* Show a placeholder if only owner exists */}
                         {collectionDetails.collaborators.length === 0 && (
                             <span className="ml-2 text-sm text-muted-foreground">(Only Owner)</span>
                         )}
                    </div>
                </DialogTrigger>
                <DialogContent className="w-[90%] sm:max-w-[480px] rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Manage Collaborators</DialogTitle>
                        <DialogDescription>View and remove collaborators from this collection.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px] pr-4"> {/* Added ScrollArea */}
                        <div className="space-y-3 py-2">
                            {/* Owner Row (Not Removable) */}
                            <div className="flex items-center justify-between gap-4 p-2 rounded-md bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={collection.owner_avatar} />
                                        <AvatarFallback>{getInitials(collection.owner_username)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">{collection.owner_username ?? 'Owner'}</p>
                                        <p className="text-xs text-muted-foreground">Owner</p>
                                    </div>
                                </div>
                                {/* Placeholder for alignment */}
                                <div className="w-8"></div> 
                            </div>

                            {/* Collaborator Rows (Removable) */}
                            {collectionDetails.collaborators.map((c) => (
                                <div key={c.user_id} className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={c.avatar_url} />
                                            <AvatarFallback>{getInitials(c.username)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{c.username ?? c.email}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{c.permission}</p>
                                        </div>
                                    </div>
                                    {/* Remove Button */}
                                    {isOwner && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" disabled={removeCollaboratorMutation.isPending && removeCollaboratorMutation.variables?.userId === c.user_id}>
                                                    {(removeCollaboratorMutation.isPending && removeCollaboratorMutation.variables?.userId === c.user_id) ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserMinus className="h-4 w-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="w-[90%] sm:max-w-[425px] rounded-lg">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove Collaborator?</AlertDialogTitle>
                                                    <AlertDialogDescription>Remove {c.username ?? c.email} from this collection?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => removeCollaboratorMutation.mutate({ collectionId: collectionId!, userId: c.user_id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                     {/* Placeholder if not owner for alignment */}
                                     {!isOwner && <div className="w-8"></div>}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                     <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* --- End Avatar Stack and Management Dialog --- */}
        </div>

        {/* Movies Section */}
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold flex items-center"><Film className="mr-2 h-5 w-5"/> Movies ({collectionDetails.movies.length})</h2>
                {canEdit && (
                    <Dialog open={isAddMovieOpen} onOpenChange={setIsAddMovieOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Movie</Button>
                        </DialogTrigger>
                        <AddMovieDialog
                            collectionId={collectionId!}
                            existingMovieIds={movieIds}
                            onAddMovie={(movieId) => addMovieMutation.mutate({ collectionId: collectionId!, data: { movieId } })}
                            isAddingMovie={addMovieMutation.isPending}
                        />
                    </Dialog>
                )}
            </div>
            {isLoadingMovies ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                     {Array.from({ length: collectionDetails.movies.length || 6 }).map((_, i) => 
                        <div key={i} className="space-y-2">
                            <Skeleton className="aspect-[2/3] w-full rounded-md" />
                            <Skeleton className="h-3 w-[80%]" />
                         </div>
                     )}
                 </div>
            ) : collectionDetails.movies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {collectionDetails.movies.map(movieEntry => {
                        const movie = moviesDetailsMap?.[movieEntry.movie_id];
                        if (!movie) return (
                            <Card key={movieEntry.movie_id} className="relative group overflow-hidden">
                                <Skeleton className="aspect-[2/3] w-full" />
                                {/* Still show remove button on skeleton if needed */}
                                {canEdit && (
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-7 w-7" onClick={() => removeMovieMutation.mutate({ collectionId: collectionId!, movieId: movieEntry.movie_id })} disabled={removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movieEntry.movie_id}>
                                        {(removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movieEntry.movie_id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} 
                                    </Button>
                                )}
                            </Card>
                        );
                        return (
                            <div key={movie.id} className="relative group">
                                <MovieCard movie={movie} />
                                {canEdit && (
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-7 w-7" onClick={() => removeMovieMutation.mutate({ collectionId: collectionId!, movieId: movie.id })} disabled={removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movie.id}>
                                        {(removeMovieMutation.isPending && removeMovieMutation.variables?.movieId === movie.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} 
                                    </Button>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 mx-2">{movieEntry.added_by_username ?? 'Unknown'}</p>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center py-12 border border-dashed">
                    <CardContent>
                        <Film className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No movies added to this collection yet.</p>
                        {canEdit && (
                             <Dialog open={isAddMovieOpen} onOpenChange={setIsAddMovieOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Movie</Button>
                                </DialogTrigger>
                                <AddMovieDialog
                                    collectionId={collectionId!}
                                    existingMovieIds={movieIds}
                                    onAddMovie={(movieId) => addMovieMutation.mutate({ collectionId: collectionId!, data: { movieId } })}
                                    isAddingMovie={addMovieMutation.isPending}
                                />
                            </Dialog>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
      </main>
    </>
  );
};


// --- Add Movie Dialog Component ---
interface AddMovieDialogProps {
    collectionId: string;
    existingMovieIds: number[];
    onAddMovie: (movieId: number) => void;
    isAddingMovie: boolean; 
}

const AddMovieDialog: React.FC<AddMovieDialogProps> = ({ collectionId, existingMovieIds, onAddMovie, isAddingMovie }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500); 
    const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null); 

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

    const handleAddClick = (movieId: number) => {
        setSelectedMovieId(movieId);
        onAddMovie(movieId);
    };

    useEffect(() => {
       if (!isAddingMovie) { setSelectedMovieId(null); }
    }, [isAddingMovie]);

    const movies = searchResultsData?.pages.flatMap(page => page.results) ?? [];

    return (
        <DialogContent className="w-[90%] sm:max-w-[600px] rounded-lg">
            {/* ... Dialog Header ... */}
             <DialogHeader>
                <DialogTitle>Add Movie to Collection</DialogTitle>
                <DialogDescription>Search TMDB and add movies.</DialogDescription>
            </DialogHeader>
            {/* Search Input */}
             <div className="relative my-4">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search TMDB..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                 {isFetching && !isFetchingNextPage && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {/* Results Area */}
            <ScrollArea className="h-[400px] border rounded-md">
                 <div className="p-4 space-y-4">
                    {/* Loading/Error/Empty States */}
                     {isLoadingSearch && debouncedSearchTerm && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}
                     {isSearchError && <div className="text-red-500 text-center p-4">Error searching: {searchError?.message}</div>}
                     {!debouncedSearchTerm && <div className="text-muted-foreground text-center p-4">Start typing to search...</div>}
                     {debouncedSearchTerm && !isLoadingSearch && !isSearchError && movies.length === 0 && (
                         <div className="text-muted-foreground text-center p-4">No results found for "{debouncedSearchTerm}".</div>
                     )}
                    {/* Movie List */}
                     {movies.map((movie) => {
                         const alreadyAdded = existingMovieIds.includes(movie.id);
                         const isCurrentMovieAdding = isAddingMovie && selectedMovieId === movie.id;
                         return (
                             <div key={movie.id} className="flex items-center gap-4 p-2 hover:bg-muted/50 rounded">
                                 <img src={getImageUrl(movie.poster_path, 'w92')} alt={movie.title} className="h-16 w-auto rounded aspect-[2/3] object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                                 <div className="flex-grow">
                                     <p className="font-medium">{movie.title}</p>
                                     <p className="text-sm text-muted-foreground">{movie.release_date?.substring(0, 4)}</p>
                                 </div>
                                 <Button size="sm" variant={alreadyAdded ? "secondary" : "default"} onClick={() => handleAddClick(movie.id)} disabled={alreadyAdded || isCurrentMovieAdding || isAddingMovie}>
                                     {isCurrentMovieAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : alreadyAdded ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                                     <span className="ml-2">{alreadyAdded ? 'Added' : 'Add'}</span>
                                 </Button>
                             </div>
                         );
                    })}
                    {/* Load More Button */}
                    {hasNextPage && (
                         <Button variant="outline" className="w-full mt-4" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                             {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Load More
                         </Button>
                     )}
                 </div>
            </ScrollArea>
            {/* Dialog Footer */}
            <DialogFooter>
                 <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    );
};

export default CollectionDetail;

