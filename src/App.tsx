import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Collections from "./pages/Collections"; // Import the new collections list page
import CollectionDetail from "./pages/CollectionDetail"; // Import the new detail page
import NotFound from "./pages/NotFound";
import { useAuth } from './hooks/useAuth'; // Import useAuth for ProtectedRoute
import { Loader2 } from 'lucide-react'; // For loading state in ProtectedRoute
// import { Navbar } from "./components/Navbar"; // Navbar is rendered within pages now

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/search" element={<Search />} />
        
        {/* Protected Routes */}
        <Route 
          path="/collections"
          element={
            <ProtectedRoute>
              <Collections />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/collection/:collectionId"
          element={
            <ProtectedRoute>
              <CollectionDetail />
            </ProtectedRoute>
          }
        />
        
        {/* Catch-all Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

// Helper component for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoadingUser } = useAuth();
  const location = useLocation();

  if (isLoadingUser) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        {/* Optional: Render Navbar even during loading? */}
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn) {
    // Redirect them to the home page if not logged in.
    // You could store the intended location in state if you want to redirect back after login
    // For OAuth, redirecting back might be handled by the server redirect anyway.
    toast.error("Please log in to view this page."); // Give feedback
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

export default App;
