import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Spinner } from '@/components/ui/spinner';

// Lazy load the views
const MapView = lazy(() => import('@/features/map/MapView'));
const SettingsView = lazy(() => import('@/features/profile/ProfileView'));

// A simple full-screen loader
const PageLoader = () => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
    <Spinner className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const routeVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="h-full w-full"
        variants={routeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<MapView />} />
          <Route path="/profile" element={<SettingsView />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* We use d-vh (dynamic viewport height) for mobile browser support */}
      <div className="h-[100dvh] w-screen overflow-x-hidden bg-background">
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
      </div>
    </BrowserRouter>
  );
}