import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, LogOut, UserCircle, List, LogIn, LoaderCircle, LayoutGrid, User, Shield, Forward, Link2, Send } from 'lucide-react';
import { LogoIcon } from '@/components/LogoIcon';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { fetchCurrentUserApi } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationBell } from './NotificationBell';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Only needed once the user opens them, so keep them (and cmdk) out of the
// bundle that every page loads.
const SearchDialog = lazy(() => import('./SearchDialog'));
const ShareDialog = lazy(() => import('./ShareDialog').then((m) => ({ default: m.ShareDialog })));

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn, logout, isLoggingOut, isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  usePushNotifications();
  const isOnLoginPage = location.pathname === '/login';

  // Fetch full user data for custom avatar
  const { data: meData } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUserApi,
    enabled: !!user,
  });
  const navAvatarUrl = meData?.user?.avatarUrl || meData?.user?.image || user?.avatarUrl || user?.image || undefined;
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // The search and share dialogs are lazy-loaded; mount each on first open and
  // keep it mounted afterwards so its close animation still plays.
  const [hasOpenedSearch, setHasOpenedSearch] = useState(false);
  const [hasOpenedShare, setHasOpenedShare] = useState(false);

  const openSearch = () => {
    setHasOpenedSearch(true);
    setSearchOpen(true);
  };

  const openShareDialog = () => {
    setHasOpenedShare(true);
    setShareDialogOpen(true);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingInField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTypingInField) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenSearch = () => openSearch();
    window.addEventListener('open-search', handleOpenSearch);
    return () => window.removeEventListener('open-search', handleOpenSearch);
  }, []);


  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const isDetailPage = location.pathname.startsWith('/media/') || location.pathname.startsWith('/person/');

  const shareMediaInfo = useMemo(() => {
    const mediaMatch = location.pathname.match(/^\/media\/(movie|tv)\/(\d+)/);
    if (mediaMatch) {
      return { mediaType: mediaMatch[1] as 'movie' | 'tv', tmdbId: Number(mediaMatch[2]) };
    }
    const personMatch = location.pathname.match(/^\/person\/(\d+)/);
    if (personMatch) {
      return { mediaType: 'person' as const, tmdbId: Number(personMatch[1]) };
    }
    return null;
  }, [location.pathname]);

  return (
    <>
      <header 
        className={`sticky top-0 z-50 flex items-center gap-4 px-4 sm:px-8 transition-[background-color,border-color,backdrop-filter] duration-(--dur-scene) ease-(--ease-out) ${scrolled ? 'glass border-b border-border' : 'bg-transparent border-b border-transparent'}`}
        style={{ 
          height: 'calc(4rem + env(safe-area-inset-top))', 
          paddingTop: 'env(safe-area-inset-top)' 
        }}
      >
        {/* Logo / Home Link */}
        <nav className="flex shrink-0 items-center gap-6 text-lg font-medium md:gap-5 md:text-sm lg:gap-6">
          <Link
            to="/"
            viewTransition
            className="flex items-center gap-2 group"
          >
            <LogoIcon className="h-7 w-7 transition-transform duration-(--dur-ui) ease-(--ease-emph) group-hover:-rotate-6" />
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">mbuffs</span>
          </Link>
          <Link
            to="/categories"
            viewTransition
            className="hidden md:flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Categories</span>
          </Link>
        </nav>

        {/* Search and User Actions */}
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="flex items-center gap-3 ml-auto">
            {/* Share / Copy link dropdown — detail pages only */}
            {isDetailPage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-foreground/6 backdrop-blur-md hover:bg-foreground/12"
                    aria-label="Share options"
                  >
                    <Forward className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({ title: 'Link copied to clipboard' });
                  }}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy Link
                  </DropdownMenuItem>
                  {isLoggedIn && shareMediaInfo && (
                    <DropdownMenuItem onClick={openShareDialog}>
                      <Send className="mr-2 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Notification bell */}
            <NotificationBell />

            {/* Search icon (desktop only — mobile uses bottom nav) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex h-9 w-9 rounded-full bg-foreground/6 backdrop-blur-md hover:bg-foreground/12"
              onClick={openSearch}
              aria-label="Open search"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Auth Section */}
            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden md:inline-flex rounded-full hover:bg-transparent transition-transform duration-(--dur-fast) active:scale-95">
                    {navAvatarUrl ? (
                      <img src={navAvatarUrl} alt={user.username || 'User Avatar'} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserCircle className="h-5 w-5" />
                    )}
                    <span className="sr-only">Toggle user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.username || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/categories')} className="cursor-pointer md:hidden">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span>Categories</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/collections')} className="cursor-pointer">
                    <List className="mr-2 h-4 w-4" />
                    <span>My Collections</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              isLoadingUser ? (
                <LoaderCircle className="animate-spin" />
              ) : !isOnLoginPage ? (
                <Button onClick={handleLogin}>
                  <LogIn className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Login</span>
                </Button>
              ) : null
            )}
          </div>
        </div>
      </header>

      {hasOpenedSearch && (
        <Suspense fallback={null}>
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      )}

      {shareMediaInfo && hasOpenedShare && (
        <Suspense fallback={null}>
          <ShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            media={shareMediaInfo}
          />
        </Suspense>
      )}
    </>
  );
};
