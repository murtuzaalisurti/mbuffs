import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, UserCircle, Popcorn, List, LogIn, Loader2, LoaderCircle, Star, LayoutGrid, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { searchMoviesApi, getImageUrl } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Movie } from '@/lib/types';
import { signIn } from '@/lib/auth-client';

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, isLoggingOut, isLoadingUser } = useAuth();
  const { toast } = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

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
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: searchResultsData, isLoading: isSearching } = useQuery({
    queryKey: ['movies', 'search', 'navbar', debouncedSearch],
    queryFn: () => searchMoviesApi(debouncedSearch),
    enabled: !!debouncedSearch && searchOpen,
    staleTime: 1000 * 60 * 5,
  });

  const searchResults = searchResultsData?.results ?? [];

  const handleSearchResultClick = (movie: Movie) => {
    const mediaType = movie.first_air_date ? 'tv' : 'movie';
    setSearchOpen(false);
    setSearchTerm('');
    navigate(`/media/${mediaType}/${movie.id}`);
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  const handleLogin = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });
  };

  return (
    <>
      <header 
        className={`sticky top-0 z-50 flex items-center gap-4 px-8 transition-all duration-300 ${scrolled ? 'glass border-b border-border/60' : 'bg-transparent border-b border-transparent'}`}
        style={{ 
          height: 'calc(4rem + env(safe-area-inset-top))', 
          paddingTop: 'env(safe-area-inset-top)' 
        }}
      >
        {/* Logo / Home Link */}
        <nav className="flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight md:text-base group"
          >
            <Popcorn className="h-5 w-5 transition-transform group-hover:scale-110" style={{ stroke: 'url(#logo-gradient)' }} />
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--foreground)" />
                  <stop offset="100%" stopColor="var(--muted-foreground)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">mbuffs</span>
          </Link>
          <Link
            to="/categories"
            className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Categories</span>
          </Link>
        </nav>

        {/* Search and User Actions */}
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="flex items-center gap-3 ml-auto">
            {/* Search icon */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-muted/70 backdrop-blur-md border border-border hover:bg-muted"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Auth Section */}
            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username || 'User Avatar'} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
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
              ) : (
                <Button onClick={handleLogin}>
                  <LogIn className="h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">Login</span>
                  <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 48 48" className="h-4 w-4" fill="currentColor">
                    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                    <path d="M24 44c5.166 0 9.86-1.977 13.412-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                    <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.846 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z" />
                  </svg>
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <CommandDialog open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearchTerm(''); }}>
        <CommandInput
          placeholder="Search movies & shows..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          autoFocus
        />
        <CommandList className="max-h-[60vh] p-2">
          {!debouncedSearch && (
            <p className="text-sm text-muted-foreground text-center py-8">Start typing to search...</p>
          )}

          {isSearching && debouncedSearch && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {debouncedSearch && !isSearching && searchResults.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!isSearching && searchResults.length > 0 && (
            <CommandGroup heading="Results">
              {searchResults.slice(0, 10).map((movie) => (
                <CommandItem
                  key={movie.id}
                  value={`${movie.name || movie.title} ${movie.first_air_date || movie.release_date || ''}`}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer"
                  onSelect={() => handleSearchResultClick(movie)}
                >
                  <img
                    src={getImageUrl(movie.poster_path, 'w92')}
                    alt={movie.name || movie.title}
                    className="h-14 w-10 rounded-md object-cover bg-muted shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  <div className="grow min-w-0">
                    <p className="text-sm font-medium truncate">{movie.name || movie.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {(movie.release_date || movie.first_air_date) && (
                        <span>{new Date(movie.first_air_date || movie.release_date).getFullYear()}</span>
                      )}
                      {movie.vote_average > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          {movie.vote_average.toFixed(1)}
                        </span>
                      )}
                      <span className="text-muted-foreground">{movie.first_air_date ? 'TV' : 'Movie'}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
