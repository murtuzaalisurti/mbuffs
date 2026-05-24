import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCircle, Search, Check, Loader2, Send } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/ui/use-toast';
import { haptics } from '@/lib/haptics';
import { fetchSuggestedUsersApi, searchUsersApi, shareMediaApi, getImageUrl } from '@/lib/api';
import type { SuggestedUser, ShareMediaInput } from '@/lib/types';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: {
    tmdbId: number;
    mediaType: 'movie' | 'tv' | 'person';
  };
}

export const ShareDialog = ({ open, onOpenChange, media }: ShareDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mediaDetails = useMemo(() => {
    if (media.mediaType === 'person') {
      const cached = queryClient.getQueryData<{ name?: string; profile_path?: string | null }>(['person', String(media.tmdbId)]);
      return { title: cached?.name || '', posterPath: cached?.profile_path ?? null };
    }
    const cached = queryClient.getQueryData<{ title?: string; name?: string; poster_path?: string | null }>([media.mediaType, 'details', String(media.tmdbId)]);
    return { title: cached?.title || cached?.name || '', posterPath: cached?.poster_path ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.tmdbId, media.mediaType, open]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Map<string, SuggestedUser>>(new Map());
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);

  const { data: suggestedData, isLoading: isSuggestedLoading } = useQuery({
    queryKey: ['share', 'suggested-users'],
    queryFn: fetchSuggestedUsersApi,
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ['share', 'search-users', debouncedSearch],
    queryFn: () => searchUsersApi(debouncedSearch),
    enabled: open && debouncedSearch.length >= 1,
    staleTime: 1000 * 60 * 2,
  });

  const shareMutation = useMutation({
    mutationFn: async (recipients: SuggestedUser[]) => {
      const results = await Promise.allSettled(
        recipients.map((user) =>
          shareMediaApi({
            recipient_id: user.id,
            tmdb_id: media.tmdbId,
            media_type: media.mediaType,
            title: mediaDetails.title,
            poster_path: mediaDetails.posterPath,
          })
        )
      );

      const succeeded: string[] = [];
      const failed: { name: string; reason: string }[] = [];

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          succeeded.push(recipients[i].id);
        } else {
          const err = result.reason as Error & { status?: number };
          failed.push({
            name: recipients[i].name || recipients[i].email,
            reason: err.status === 409 ? 'already shared recently' : err.message,
          });
        }
      });

      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      setSentTo((prev) => {
        const next = new Set(prev);
        succeeded.forEach((id) => next.add(id));
        return next;
      });
      setSelected(new Map());

      if (succeeded.length > 0) {
        haptics.trigger('success');
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }

      if (failed.length > 0 && succeeded.length === 0) {
        toast({
          title: 'Failed to share',
          description: failed.map((f) => `${f.name}: ${f.reason}`).join(', '),
          variant: 'destructive',
        });
      } else if (failed.length > 0) {
        toast({
          title: `Shared with ${succeeded.length}, ${failed.length} failed`,
          description: failed.map((f) => `${f.name}: ${f.reason}`).join(', '),
        });
      }
    },
  });

  const toggleUser = (user: SuggestedUser) => {
    if (sentTo.has(user.id)) return;
    haptics.trigger('selection');
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0) return;
    shareMutation.mutate([...selected.values()]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchTerm('');
      setSelected(new Map());
      setSentTo(new Set());
    }
    onOpenChange(nextOpen);
  };

  const showSearch = debouncedSearch.length >= 1;
  const users = showSearch ? (searchData?.users ?? []) : (suggestedData?.users ?? []);
  const isLoading = showSearch ? isSearching : isSuggestedLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="text-base">Share</DialogTitle>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <img
              src={getImageUrl(mediaDetails.posterPath, 'w92')}
              alt=""
              className="h-8 w-6 rounded object-cover bg-muted shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
            />
            <span className="truncate">{mediaDetails.title}</span>
          </div>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {[...selected.values()].map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                {user.name || user.email}
                <span className="text-primary/60">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="px-4 pb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {showSearch ? 'Search Results' : 'Suggested'}
          </p>
        </div>

        <ScrollArea className="max-h-[50vh] min-h-[120px]">
          <div className="px-2 pb-4">
            {isLoading && (
              <div className="space-y-1 px-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {showSearch ? 'No users found' : 'No suggested users yet'}
              </p>
            )}

            {!isLoading && users.map((user) => {
              const isSelected = selected.has(user.id);
              const alreadySent = sentTo.has(user.id);

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user)}
                  disabled={alreadySent}
                  className={`flex items-center gap-3 w-full px-2 py-2.5 rounded-lg transition-colors text-left disabled:opacity-60 ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="relative shrink-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className={`h-9 w-9 rounded-full object-cover ${isSelected ? 'ring-2 ring-primary' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-muted ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {alreadySent && (
                    <span className="text-xs text-green-500 font-medium shrink-0">Sent</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-4 py-3 border-t border-border">
          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={selected.size === 0 || shareMutation.isPending}
          >
            {shareMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {selected.size === 0
              ? 'Select users to share'
              : `Share with ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
