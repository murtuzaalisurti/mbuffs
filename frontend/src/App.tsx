import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import CollectionDetailsPage from './pages/collection/[collectionId]';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import CollectionsPage from './pages/CollectionsPage';
import PublicCollectionView from './pages/collection/public/[shareableId]';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/register',
      element: <RegisterPage />,
    },
    {
      path: '/profile',
      element: (
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/collections',
      element: (
        <ProtectedRoute>
          <CollectionsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/collection/:collectionId',
      element: (
        <ProtectedRoute>
          <CollectionDetailsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/collection/:shareableId',
      element: <PublicCollectionView />,
    },
  ]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;