import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchUnreadCountApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Popover content only mounts while open, so the panel (and its notification
// list code) loads the first time the bell is clicked, not on every page.
const NotificationPanel = lazy(() =>
  import('./NotificationPanel').then((m) => ({ default: m.NotificationPanel }))
);

export const NotificationBell = () => {
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCountApi,
    enabled: isLoggedIn,
    staleTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const unreadCount = data?.count ?? 0;

  if (!isLoggedIn) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full bg-foreground/6 backdrop-blur-md hover:bg-foreground/12"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 tabular-nums"
              aria-live="polite"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <NotificationPanel onClose={() => setOpen(false)} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
};
