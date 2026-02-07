import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { Spinner } from '@/components/ui/spinner';

// Lazy load the views
const MapView = lazy(() => import('@/features/map/MapView'));
const SearchView = lazy(() => import('@/features/search/SearchView'));
const SettingsView = lazy(() => import('@/features/profile/ProfileView'));

// A simple full-screen loader
const PageLoader = () => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
    <Spinner className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      {/* We use d-vh (dynamic viewport height) for mobile browser support */}
      <div className="h-[100dvh] w-screen overflow-hidden bg-background">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<MapView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/profile" element={<SettingsView />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}