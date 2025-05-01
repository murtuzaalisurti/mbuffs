import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserCollectionsApi, createCollectionApi } from '@/lib/api';
import { UserCollectionsResponse, CreateCollectionInput, CollectionSummary } from '@/lib/types';
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, Film, Calendar, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCollectionSchema } from '../../backend/lib/validators'; // **Important: Adjust path or copy schema**
import { z } from 'zod';
import { useState } from 'react';
import { toast } from "sonner";

// **Important**: Copy/paste the Zod schema from backend or share via a common package
const frontendCreateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name cannot be empty").max(255),
  description: z.string().max(1000).optional(),
});
type FrontendCreateCollectionInput = z.infer<typeof frontendCreateCollectionSchema>;


const COLLECTIONS_QUERY_KEY = ['collections', 'user'];

const Collections = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { 
    data: collectionsData,
    isLoading,
    isError,
    error 
  } = useQuery<UserCollectionsResponse, Error>({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: fetchUserCollectionsApi,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FrontendCreateCollectionInput>({
    resolver: zodResolver(frontendCreateCollectionSchema),
  });

  const createMutation = useMutation<{
    collection: CollectionSummary
  }, Error, CreateCollectionInput>({ // Correct types
    mutationFn: createCollectionApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      toast.success(`Collection "${data.collection.name}" created!`);
      reset();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create collection: ${error.message}`);
    }
  });

  const onSubmit = (formData: FrontendCreateCollectionInput) => {
    createMutation.mutate(formData);
  };

  const formatDate = (dateString: string) => {
     return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <>
      <Navbar />
      <main className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Collections</h1>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Collection</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90%] sm:max-w-[425px] rounded-lg">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create New Collection</DialogTitle>
                  <DialogDescription>
                    Give your new movie collection a name and optional description.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="name" className="text-sm text-muted-foreground">
                      Name
                    </Label>
                    <Input 
                      id="name"
                      {...register("name")}
                      className="bg-muted"
                      aria-invalid={errors.name ? "true" : "false"}
                    />
                    {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="description" className="text-sm text-muted-foreground">
                      Description
                    </Label>
                    <Textarea 
                      id="description"
                      {...register("description")}
                      className="bg-muted" 
                      aria-invalid={errors.description ? "true" : "false"}
                    />
                     {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                    Create Collection
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                   <Skeleton className="h-4 w-1/3" />
                </CardContent>
                 <CardFooter>
                    <Skeleton className="h-8 w-24" />
                 </CardFooter>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="text-red-500 text-center py-12">
            Error loading collections: {error.message}
          </div>
        ) : collectionsData?.collections && collectionsData.collections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectionsData.collections.map((collection) => (
              <Card key={collection.id}>
                <CardHeader>
                  <CardTitle className="hover:text-primary transition-colors">
                     <Link to={`/collection/${collection.id}`}>{collection.name}</Link>
                  </CardTitle>
                  {collection.description && (
                    <CardDescription className="line-clamp-3">
                       {collection.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div className="flex items-center mb-1">
                    <Users className="h-4 w-4 mr-2" /> Owner: {collection.owner_username ?? 'Unknown'}
                  </div>
                  <div className="flex items-center">
                     <Calendar className="h-4 w-4 mr-2" /> Created: {formatDate(collection.created_at)}
                  </div>
                   {/* TODO: Add movie count and collaborator count later */}
                </CardContent>
                <CardFooter>
                   <Link to={`/collection/${collection.id}`}>
                     <Button variant="outline" size="sm">View Collection</Button>
                   </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Film className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">No collections yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Get started by creating your first movie collection.
            </p>
             <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="mt-4">
                   <PlusCircle className="mr-2 h-4 w-4" /> Create Collection
                </Button>
              </DialogTrigger>
             {/* DialogContent is defined above */}
            </Dialog>
          </div>
        )}
      </main>
    </>
  );
};

export default Collections;
