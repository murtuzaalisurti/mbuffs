import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, UserCircle, Film, List } from 'lucide-react';
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
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
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
          <span className="sr-only">mbuffs</span>
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
                <form onSubmit={handleSearch} className="">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search movies..."
                      className="w-[200px] pl-8 md:w-[300px]" // Keep responsive width
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
                  <a href={googleLoginUrl}>Login with Google</a>
                </Button>
              )}
        </div>
      </div>
    </header>
  );
};
