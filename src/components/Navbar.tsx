import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, UserCircle, Popcorn, List, LogIn, Loader2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, isLoggingOut, isLoadingUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // check initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(''); // Optionally clear search after navigation
    } else {
      toast({
        title: "Search Error",
        description: "Please enter a movie title to search.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    // Optional: redirect to home after logout
    // navigate('/');
  };

  // Construct Google Login URL - Ensure VITE_BACKEND_URL is set in your .env
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const googleLoginUrl = `${backendUrl}/api/auth/google`;

  return (
    <header className={`sticky top-0 z-50 flex h-14 items-center gap-4 px-4 md:px-6 transition-all duration-300 ${scrolled ? 'glass border-b border-white/[0.06]' : 'bg-transparent border-b border-transparent'}`}>
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
                <stop offset="0%" stopColor="hsl(196 80% 60%)" />
                <stop offset="100%" stopColor="hsl(260 60% 65%)" />
              </linearGradient>
            </defs>
          </svg>
          <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">mbuffs</span>
        </Link>
      </nav>

      {/* Search and User Actions */}
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="flex items-center gap-3 ml-auto">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex-1 md:flex-initial">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Search movies..."
                className="!pl-9 !pr-4 !h-9 w-32 sm:w-48 md:w-64 lg:w-80 !bg-black/40 !backdrop-blur-md !text-white !placeholder-white/50 !rounded-xl !border-white/[0.12] !ring-offset-0 focus-visible:!ring-1 focus-visible:!ring-primary/40 focus-visible:!bg-black/50 focus-visible:!border-primary/30 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Auth Section */}
          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username || 'User Avatar'} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <UserCircle className="h-5 w-5" />
                  )}
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.username || user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/collections')} className="cursor-pointer">
                  <List className="mr-2 h-4 w-4" />
                  <span>My Collections</span>
                </DropdownMenuItem>
                {/* <DropdownMenuItem>Settings</DropdownMenuItem> */}
                {/* <DropdownMenuItem>Support</DropdownMenuItem> */}
                {/* <DropdownMenuSeparator /> */}
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="cursor-pointer text-red-600 focus:bg-red-100 focus:text-red-700">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            isLoadingUser ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Button asChild>
                <a href={googleLoginUrl}>
                  <LogIn className="h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">Login</span>
                  <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 48 48" className="h-4 w-4" fill="currentColor"> {/* Set fill to currentColor */}
                    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                    <path d="M24 44c5.166 0 9.86-1.977 13.412-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                    <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.846 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z" />
                  </svg>
                </a>

              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
