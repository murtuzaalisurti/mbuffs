import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, UserCircle, Film, List, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth'; // Adjust path as needed
import { useToast } from '@/components/ui/use-toast'; // Import useToast

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, isLoggingOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast(); // Get toast function

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
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Logo / Home Link */}
      <nav className="flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <Film className="h-6 w-6 text-primary" />
          <span>mbuffs</span>
        </Link>
        {/* Optional: Add other nav links here if needed */}
        {/* <Link
          to="/trends"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Trends
        </Link> */}
      </nav>

      {/* Search and User Actions */}
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="flex items-center gap-4 ml-auto"> { /* Use ml-auto to push auth to the right */}
                {/* Search Form - removed hidden md:block */}
                <form onSubmit={handleSearch} className="flex-1 md:flex-initial">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search..."
                      className="pl-8 w-32 sm:w-50 md:w-64 lg:w-80 bg-muted text-muted-foreground focus-visible:ring-primary focus-visible:ring-offset-0 rounded-lg border border-border" // Keep responsive width
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
                        <img src={user.avatar_url} alt={user.username || 'User Avatar'} className="h-8 w-8 rounded-full" />
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
                <Button asChild>
                  <a href={googleLoginUrl}>
                    <LogIn className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Login</span>
                    <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 48 48" className="h-4 w-4" fill="currentColor"> {/* Set fill to currentColor */}
                      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                      <path d="M24 44c5.166 0 9.86-1.977 13.412-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                      <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.846 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                    </svg>
                  </a>
                </Button>
              )}
        </div>
      </div>
    </header>
  );
};
