import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Search, User, LogIn, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth"; // Import the useAuth hook
import { getImageUrl } from "../lib/api"; // Import getImageUrl for avatar
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // For user avatar

// No longer need props for auth state
export function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user, isLoggedIn, isLoadingUser, logout, isLoggingOut } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(""); // Clear search input after navigation
    }
  };

  const handleGoogleLogin = () => {
    // Redirect the browser directly to the backend Google login route
    const backendLoginUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api'}/auth/google`;
    window.location.href = backendLoginUrl;
  };

  const handleLogout = () => {
    logout(); // Call the logout mutation from useAuth hook
  };

  const getInitials = (name?: string | null) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '';
  }

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-6 md:gap-10">
          <Link to="/" className="flex items-center space-x-2">
            <Film className="h-6 w-6 text-primary" />
            <span className="font-bold">MBuffs</span> {/* Updated Name */} 
          </Link>
          <div className="hidden gap-6 md:flex">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Discover
            </Link>
            {isLoggedIn && (
              <Link
                to="/collections"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                My Collections
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search movies..."
                className="w-[200px] pl-8 md:w-[300px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {isLoadingUser ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : isLoggedIn && user ? (
            <div className="flex items-center gap-4">
              {/* Optional: Link to a profile page if you create one */}
              {/* <Link to="/profile" className="flex items-center gap-2"> */}
              <Avatar className="h-8 w-8">
                <AvatarImage src={getImageUrl(user.avatarUrl)} alt={user.username ?? 'User avatar'} />
                <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user.username ?? user.email}</span>
              {/* </Link> */}
              <Button onClick={handleLogout} variant="outline" size="sm" disabled={isLoggingOut}>
                {isLoggingOut ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                )}
                Logout
              </Button>
            </div>
          ) : (
            <Button onClick={handleGoogleLogin} size="sm">
              <LogIn className="mr-2 h-4 w-4" /> Login with Google
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
