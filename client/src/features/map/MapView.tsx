import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Map,
    MapControls,
    MapMarker,
    MarkerContent,
    MarkerPopup,
} from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Locate, SlidersHorizontal, User, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useMapStore } from '@/store/map-store';
import type { Map as MapLibreInstance } from 'maplibre-gl';
// import dinoPng from '@/assets/dinosaur.png'
import { DinoChat } from '@/components/DinoChat';
import { useAuth0 } from '@auth0/auth0-react';

type StudyGroup = {
    id: string;
    name: string;
    module: string;
    interests: string[];
    members: number;
    description: string;
    location: {
        lng: number;
        lat: number;
    };
};

const GROUPS: StudyGroup[] = [
    {
        id: 'group-ux-01',
        name: 'Design Systems Collective',
        module: 'Human Computer Interaction',
        interests: ['Design', 'Productivity', 'Reading'],
        members: 12,
        description: 'Weekly critique and component library study sessions.',
        location: { lng: -1.5749, lat: 54.7759 },
    },
    {
        id: 'group-ai-02',
        name: 'Applied AI Lab',
        module: 'Machine Learning',
        interests: ['Productivity', 'Gaming', 'Reading'],
        members: 18,
        description: 'Project-based practice with supervised and unsupervised models.',
        location: { lng: -1.5702, lat: 54.7785 },
    },
    {
        id: 'group-web-03',
        name: 'Frontend Explorers',
        module: 'Web Development',
        interests: ['Design', 'Photography', 'Music'],
        members: 9,
        description: 'Build-along sessions on modern UI patterns and accessibility.',
        location: { lng: -1.5794, lat: 54.7808 },
    },
    {
        id: 'group-data-04',
        name: 'Data Insight Circle',
        module: 'Data Analytics',
        interests: ['Reading', 'Fitness', 'Outdoors'],
        members: 14,
        description: 'Case study breakdowns and dashboard review meetups.',
        location: { lng: -1.5821, lat: 54.7734 },
    },
    {
        id: 'group-sec-05',
        name: 'Security Sprint',
        module: 'Cyber Security',
        interests: ['Gaming', 'Productivity', 'Outdoors'],
        members: 11,
        description: 'CTF practice and threat modeling sessions.',
        location: { lng: -1.5683, lat: 54.7721 },
    },
    {
        id: 'group-cloud-06',
        name: 'Cloud Builders',
        module: 'Cloud Computing',
        interests: ['Music', 'Productivity', 'Reading'],
        members: 16,
        description: 'Infrastructure labs with shared notes and diagrams.',
        location: { lng: -1.5718, lat: 54.7816 },
    },
];

const MODULE_OPTIONS = [
    'All modules',
    ...Array.from(new Set(GROUPS.map((group) => group.module))),
];

const INTEREST_OPTIONS = Array.from(
    new Set(GROUPS.flatMap((group) => group.interests))
);

const DEFAULT_CENTER: [number, number] = [-1.57566, 54.77676];
const DEFAULT_ZOOM = 12;
const GEO_ZOOM = 14;

export default function MapView() {
    const { user } = useAuth0();
    const { center, zoom, setMapState } = useMapStore();
    const mapRef = useRef<MapLibreInstance | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [geoError, setGeoError] = useState<string | null>(null);
    const pendingLocationRef = useRef<{ lng: number; lat: number } | null>(null);
    const [nameQuery, setNameQuery] = useState('');
    const [selectedModule, setSelectedModule] = useState(MODULE_OPTIONS[0]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    
    // State to track if the image failed to load
    const [imgError, setImgError] = useState(false);

    // Handler for when the map ref is set
    const handleMapRef = useCallback((map: MapLibreInstance | null) => {
        mapRef.current = map;
        if (map) {
            // Wait for the map to be loaded before marking it as ready
            if (map.loaded()) {
                setIsMapReady(true);
            } else {
                map.on('load', () => setIsMapReady(true));
            }
        } else {
            setIsMapReady(false);
        }
    }, []);

    // We attach this callback to the map's "moveend" event
    // to save state only when the user stops dragging.
    const handleMoveEnd = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const { lng, lat } = map.getCenter();
        setMapState([lng, lat], map.getZoom());
    }, [setMapState]);

    // Attach the moveend listener when the map is ready
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isMapReady) return;

        map.on('moveend', handleMoveEnd);

        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [handleMoveEnd, isMapReady]);

    const applyLiveLocation = useCallback(
        (coords: { lng: number; lat: number }) => {
            setMapState([coords.lng, coords.lat], GEO_ZOOM);
            const map = mapRef.current;
            if (map && map.loaded()) {
                map.flyTo({
                    center: [coords.lng, coords.lat],
                    zoom: GEO_ZOOM,
                    duration: 1500,
                });
            } else {
                pendingLocationRef.current = coords;
            }
        },
        [setMapState]
    );

    useEffect(() => {
        if (!isMapReady || !pendingLocationRef.current) return;
        const coords = pendingLocationRef.current;
        mapRef.current?.flyTo({
            center: [coords.lng, coords.lat],
            zoom: GEO_ZOOM,
            duration: 1500,
        });
        pendingLocationRef.current = null;
    }, [isMapReady]);

    useEffect(() => {
        const isDefaultCenter =
            center[0] === DEFAULT_CENTER[0] && center[1] === DEFAULT_CENTER[1];
        const isDefaultZoom = zoom === DEFAULT_ZOOM;

        if (!isDefaultCenter || !isDefaultZoom) return;
        if (!('geolocation' in navigator)) return;
        if (typeof window !== 'undefined' && !window.isSecureContext) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                applyLiveLocation({
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                });
            },
            () => undefined,
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }, [applyLiveLocation, center, zoom]);

    const filteredGroups = useMemo(() => {
        const trimmedQuery = nameQuery.trim().toLowerCase();

        return GROUPS.filter((group) => {
            const matchesName = trimmedQuery
                ? group.name.toLowerCase().includes(trimmedQuery)
                : true;
            const matchesModule =
                selectedModule === 'All modules'
                    ? true
                    : group.module === selectedModule;
            const matchesInterests =
                selectedInterests.length === 0
                    ? true
                    : group.interests.some((interest) =>
                        selectedInterests.includes(interest)
                    );

            return matchesName && matchesModule && matchesInterests;
        });
    }, [nameQuery, selectedModule, selectedInterests]);

    const handleToggleInterest = (interest: string) => {
        setSelectedInterests((prev) =>
            prev.includes(interest)
                ? prev.filter((item) => item !== interest)
                : [...prev, interest]
        );
    };

    const handleClearFilters = () => {
        setNameQuery('');
        setSelectedModule(MODULE_OPTIONS[0]);
        setSelectedInterests([]);
    };

    const handleRecenter = () => {
        if (!('geolocation' in navigator)) {
            setGeoError('Location is not supported on this device.');
            return;
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setGeoError('Location requires HTTPS on Safari.');
            return;
        }
        setIsLocating(true);
        setGeoError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                applyLiveLocation({
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                });
                setIsLocating(false);
            },
            (error) => {
                setIsLocating(false);
                if (error.code === error.PERMISSION_DENIED) {
                    setGeoError('Allow location access in Safari settings.');
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    setGeoError('Location is unavailable right now.');
                } else if (error.code === error.TIMEOUT) {
                    setGeoError('Location request timed out.');
                } else {
                    setGeoError('Unable to retrieve your location.');
                }
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    return (
        <div className="relative h-full w-full">
            <Map
                ref={handleMapRef}
                center={[center[0], center[1]]}
                zoom={zoom}
                className="h-full w-full"
            >
                <MapControls
                    position="bottom-right"
                    showZoom={false}
                    showCompass={false}
                />
                {filteredGroups.map((group) => (
                    <MapMarker
                        key={group.id}
                        longitude={group.location.lng}
                        latitude={group.location.lat}
                    >
                        <MarkerContent className="rounded-full bg-primary/20 p-1">
                            <div className="h-3 w-3 rounded-full bg-primary shadow-sm" />
                        </MarkerContent>
                        <MarkerPopup closeButton>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">{group.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {group.module}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {group.members} members
                                </p>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                ))}
            </Map>

            {/* Profile Button (Top Right) */}
            <div className="absolute top-4 right-4 z-10">
                <Link to="/profile">
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0 overflow-hidden"
                        aria-label="Go to profile"
                    >
                        {user?.picture && !imgError ? (
                            <img
                                src={user.picture}
                                alt={user.name || "Profile"}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <User className="h-5 w-5" />
                        )}
                    </Button>
                </Link>
            </div>

            <div className="absolute top-4 left-4 z-10 md:hidden">
                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0"
                    onClick={() => setIsFiltersOpen((prev) => !prev)}
                    aria-label="Toggle filters"
                    aria-expanded={isFiltersOpen}
                >
                    <SlidersHorizontal className="h-5 w-5" />
                </Button>
            </div>

            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-3">
                {geoError && (
                    <div className="max-w-[220px] rounded-lg border border-border bg-background/90 px-3 py-2 text-right text-xs text-muted-foreground shadow-md backdrop-blur">
                        {geoError}
                    </div>
                )}
                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0"
                    onClick={handleRecenter}
                    disabled={isLocating}
                    aria-label="Recenter to your location"
                >
                    {isLocating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Locate className="h-5 w-5" />
                    )}
                </Button>
                <DinoChat />
            </div>

            <div className="absolute bottom-4 left-4 z-10">
                <Link to="/add">
                    <Button variant="secondary" size="icon" className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0">
                        <Plus className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <Card
                className={`absolute bottom-4 left-4 right-4 z-10 w-auto max-h-[65vh] overflow-hidden transition-all duration-300 ease-out md:top-4 md:bottom-auto md:right-auto md:w-[min(92vw,380px)] md:opacity-100 md:translate-y-0 md:pointer-events-auto ${isFiltersOpen
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-4 pointer-events-none md:opacity-100 md:translate-y-0 md:pointer-events-auto"
                    }`}
            >
                <CardHeader className="border-b">
                    <div className="space-y-1">
                        <CardTitle>Find groups</CardTitle>
                        <CardDescription>
                            Filter the map by name, module, or interest.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                    <div className="space-y-2">
                        <Label htmlFor="map-group-name">Group name</Label>
                        <Input
                            id="map-group-name"
                            value={nameQuery}
                            onChange={(event) => setNameQuery(event.target.value)}
                            placeholder="Search by group name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="map-module-select">Module</Label>
                        <select
                            id="map-module-select"
                            value={selectedModule}
                            onChange={(event) =>
                                setSelectedModule(event.target.value)
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {MODULE_OPTIONS.map((module) => (
                                <option key={module} value={module}>
                                    {module}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-3">
                        <Label>Common interests</Label>
                        <div className="flex flex-wrap gap-2 pb-2">
                            {INTEREST_OPTIONS.map((interest) => {
                                const isActive = selectedInterests.includes(
                                    interest
                                );
                                return (
                                    <button
                                        key={interest}
                                        type="button"
                                        onClick={() =>
                                            handleToggleInterest(interest)
                                        }
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition ${isActive
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-background text-foreground'
                                            }`}
                                    >
                                        {interest}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-5">
                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {filteredGroups.length} group
                            {filteredGroups.length === 1 ? '' : 's'} shown
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleClearFilters}
                        >
                            Clear filters
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}