import React, { Suspense, lazy, useEffect, useRef, createContext, useContext } from 'react';
import { Toaster } from "@/components/ui/toaster"; // Keep this Toaster
import { Toaster as Sonner } from "@/components/ui/sonner"; // Keep Sonner
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { useAuth } from './hooks/useAuth';
import { useRecommendationPrefetch } from './hooks/useRecommendationPrefetch';
import { useToast } from "@/components/ui/use-toast"; // Import the correct useToast

const Index = lazy(() => import("./pages/Index"));
const Search = lazy(() => import("./pages/Search"));
const Collections = lazy(() => import("./pages/Collections"));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail"));
const Categories = lazy(() => import("./pages/Categories"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MovieDetail = lazy(() => import('./pages/MovieDetail'));
const SeasonDetail = lazy(() => import('./pages/SeasonDetail'));
const PersonDetail = lazy(() => import('./pages/PersonDetail'));
const ForYou = lazy(() => import('./pages/ForYou'));
const WatchedItems = lazy(() => import('./pages/WatchedItems'));
const NotInterestedItems = lazy(() => import('./pages/NotInterestedItems'));
const Auth = lazy(() => import('./pages/Auth'));
const Admin = lazy(() => import('./pages/Admin'));

// Scrolls to top on every navigation (except browser back/forward)
const ScrollToTop = () => {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navType]);

  return null;
};

// A thin tungsten bar at the top edge: quieter than a spinner, and it keeps
// the page underneath calm while a route or the session loads.
const RouteLoadingFallback = () => (
  <div className="min-h-screen" role="progressbar" aria-label="Loading" aria-busy="true">
    <div className="fixed inset-x-0 top-0 z-60 h-0.5 overflow-hidden">
      <div className="h-full w-1/3 bg-primary animate-[loading-bar_1.1s_var(--ease-emph)_infinite]" />
    </div>
  </div>
);

// Context to expose recommendation cache warming to any component
type RecommendationPrefetchContextType = {
  warmRecommendations: () => void;
};

const RecommendationPrefetchContext = createContext<RecommendationPrefetchContextType>({
  warmRecommendations: () => {},
});

export const useWarmRecommendations = () => useContext(RecommendationPrefetchContext);

// AuthProvider wrapper to initialize auth, prefetch recommendations, and expose warming
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize the auth hook. The useEffect inside useAuth handles the token from URL.
  useAuth();
  const { warmRecommendations } = useRecommendationPrefetch();
  return (
    <RecommendationPrefetchContext.Provider value={{ warmRecommendations }}>
      {children}
    </RecommendationPrefetchContext.Provider>
  );
};

// Helper component for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoadingUser } = useAuth();
  const location = useLocation();
  const { toast } = useToast(); // Use the imported hook
  const hasShownToastRef = useRef(false);

  useEffect(() => {
    if (!isLoadingUser && !isLoggedIn && !hasShownToastRef.current) {
      hasShownToastRef.current = true;
      toast({
        title: "Access Denied.",
        description: "Please log in to view this page.",
        variant: "destructive",
      });
      return;
    }

    if (isLoggedIn) {
      hasShownToastRef.current = false;
    }
  }, [isLoadingUser, isLoggedIn, toast]);

  if (isLoadingUser) {
    return <RouteLoadingFallback />;
  }

  if (!isLoggedIn) {
    // Redirect them to the login page if not logged in.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoadingUser, user } = useAuth();
  const location = useLocation();

  if (isLoadingUser) {
    return <RouteLoadingFallback />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user?.role || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Shell shared by every route: scroll handling, auth, the lazy-route boundary
// and the mobile tab bar.
const RootLayout = () => (
  <>
    <ScrollToTop />
    <AuthProvider>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
      <BottomNav />
    </AuthProvider>
  </>
);

// A data router (rather than <BrowserRouter>) is what lets links opt into
// View Transitions with the `viewTransition` prop.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Public Routes */}
      <Route path="/" element={<Index />} />
      <Route path="/search" element={<Search />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/categories/:mediaType/:genreId" element={<CategoryDetail />} />
      <Route path="/media/:mediaType/:mediaId" element={<MovieDetail />} />
      <Route path="/tv/:mediaId/season/:seasonNumber" element={<SeasonDetail />} />
      <Route path="/person/:personId" element={<PersonDetail />} />
      <Route path="/collection/:collectionId" element={<CollectionDetail />} />
      <Route path="/login" element={<Auth />} />

      {/* Protected Routes */}
      <Route
        path="/for-you"
        element={
          <ProtectedRoute>
            <ForYou />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/collections"
        element={
          <ProtectedRoute>
            <Collections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        }
      />
      <Route
        path="/watched"
        element={
          <ProtectedRoute>
            <WatchedItems />
          </ProtectedRoute>
        }
      />
      <Route
        path="/not-interested"
        element={
          <ProtectedRoute>
            <NotInterestedItems />
          </ProtectedRoute>
        }
      />

      {/* Catch-all Route */}
      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <RouterProvider router={router} />
  </TooltipProvider>
);

export default App;
