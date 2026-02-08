import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Spinner } from '@/components/ui/spinner';
import { Auth0Authentication } from '@/components/Auth0Authentication';
import { OnboardingGate } from '@/components/OnboardingGate';
import { useAuth0 } from '@auth0/auth0-react';
import { apiRequest, ApiError } from '@/lib/api';

// Lazy load the views
const MapView = lazy(() => import('@/features/map/MapView'));
const SettingsView = lazy(() => import('@/features/profile/ProfileView'));
const AddView = lazy(() => import('@/features/add/AddView').then(module => ({ default: module.AddView })));
const GroupMembersView = lazy(() => import('@/features/group/GroupMembersView'));

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

type GroupMeResponse = {
  data: {
    _id: string;
  } | null;
};

function GroupGate() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentGroupId(null);
      setIsChecking(false);
      return;
    }

    let isActive = true;

    const loadCurrentGroup = async () => {
      setIsChecking(true);
      try {
        const response = await apiRequest<GroupMeResponse>(
          '/groups/me',
          { method: 'GET' },
          () =>
            getAccessTokenSilently({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              },
            })
        );

        if (!isActive) return;
        setCurrentGroupId(response?.data?._id ?? null);
      } catch (err) {
        if (!isActive) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setCurrentGroupId(null);
        } else {
          setCurrentGroupId(null);
        }
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    void loadCurrentGroup();

    return () => {
      isActive = false;
    };
  }, [getAccessTokenSilently, isAuthenticated, location.key]);

  if (isChecking) {
    return <PageLoader />;
  }

  if (currentGroupId) {
    return <GroupMembersView groupId={currentGroupId} />;
  }

  return <MapView />;
}

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
          <Route path="/" element={<GroupGate />} />
          <Route path="/profile" element={<SettingsView />} />
          <Route path="/add" element={<AddView />} />
          <Route path="/groups/:groupId/members" element={<GroupMembersView />} />
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
        <Auth0Authentication>
          <OnboardingGate>
            <Suspense fallback={<PageLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </OnboardingGate>
        </Auth0Authentication>
      </div>
    </BrowserRouter>
  );
}