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
import { Loader2, Locate, SlidersHorizontal, User, Plus, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useMapStore } from '@/store/map-store';
import type { Map as MapLibreInstance } from 'maplibre-gl';
// import dinoPng from '@/assets/dinosaur.png'
import { DinoChat } from '@/components/DinoChat';
import { useAuth0 } from '@auth0/auth0-react';
import { apiRequest, ApiError } from '@/lib/api';

type ApiGroup = {
    _id: string;
    name: string;
    creator: string;
    members: string[];
    startAt: string;
    endAt: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
    };
    interest?: string | null;
    module?: {
        moduleId: string;
        name: string;
        course: string;
        university?: string;
    } | null;
};

const DEFAULT_CENTER: [number, number] = [-1.57566, 54.77676];
const DEFAULT_ZOOM = 12;
const GEO_ZOOM = 14;

export default function MapView() {
    const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
    const { center, zoom, setMapState } = useMapStore();
    const mapRef = useRef<MapLibreInstance | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [geoError, setGeoError] = useState<string | null>(null);
    const pendingLocationRef = useRef<{ lng: number; lat: number } | null>(null);
    const [nameQuery, setNameQuery] = useState('');
    const [selectedModule, setSelectedModule] = useState('All modules');
    const [interestQuery, setInterestQuery] = useState('');
    const [interestError, setInterestError] = useState<string | null>(null);
    const [isInterestSearching, setIsInterestSearching] = useState(false);
    const [groups, setGroups] = useState<ApiGroup[]>([]);
    const [groupsError, setGroupsError] = useState<string | null>(null);
    const [isGroupsLoading, setIsGroupsLoading] = useState(false);
    const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinErrorGroupId, setJoinErrorGroupId] = useState<string | null>(null);
    const navigate = useNavigate();

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

    const loadGroups = useCallback(async () => {
        setIsGroupsLoading(true);
        setGroupsError(null);
        try {
            const response = await apiRequest<{ data: ApiGroup[] }>(
                '/groups',
                { method: 'GET' },
                () =>
                    getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                        },
                    })
            );
            setGroups(response.data ?? []);
        } catch (err) {
            setGroups([]);
            if (err instanceof ApiError) {
                setGroupsError(`Unable to load groups. (${err.status})`);
            } else {
                setGroupsError('Unable to load groups.');
            }
        } finally {
            setIsGroupsLoading(false);
        }
    }, [getAccessTokenSilently]);

    useEffect(() => {
        if (!isAuthenticated) {
            setGroups([]);
            setGroupsError(null);
            setIsGroupsLoading(false);
            return;
        }

        void loadGroups();
    }, [isAuthenticated, loadGroups]);

    const moduleOptions = useMemo(() => {
        const modules = new Set<string>();
        groups.forEach((group) => {
            if (group.module?.name) {
                modules.add(group.module.name);
            }
        });
        return ['All modules', ...Array.from(modules)];
    }, [groups]);

    const getGroupTitle = useCallback((group: ApiGroup) => {
        return group.name || group.module?.name || group.interest || 'Study group';
    }, []);

    const filteredGroups = useMemo(() => {
        const trimmedQuery = nameQuery.trim().toLowerCase();

        return groups.filter((group) => {
            const groupName = (group.name || '').toLowerCase();
            const matchesName = trimmedQuery
                ? groupName.includes(trimmedQuery)
                : true;
            const matchesModule =
                selectedModule === 'All modules'
                    ? true
                    : group.module?.name === selectedModule;

            return matchesName && matchesModule;
        });
    }, [getGroupTitle, groups, nameQuery, selectedModule]);

    const handleClearFilters = () => {
        setNameQuery('');
        setSelectedModule('All modules');
        setInterestQuery('');
        setInterestError(null);
        if (isAuthenticated) {
            void loadGroups();
        }
    };

    const handleInterestSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isAuthenticated) {
            setInterestError('Sign in to search interests.');
            return;
        }

        const query = interestQuery.trim();
        if (!query) {
            setInterestError(null);
            await loadGroups();
            return;
        }

        setIsInterestSearching(true);
        setInterestError(null);
        try {
            const response = await apiRequest<{ data: ApiGroup[] }>(
                '/groups/search',
                {
                    method: 'POST',
                    body: JSON.stringify({ query }),
                },
                () =>
                    getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                        },
                    })
            );
            setGroups(response.data ?? []);
        } catch (err) {
            if (err instanceof ApiError) {
                setInterestError(`Interest search failed. (${err.status})`);
            } else {
                setInterestError('Interest search failed.');
            }
        } finally {
            setIsInterestSearching(false);
        }
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

    const handleJoinGroup = async (groupId: string) => {
        setJoiningGroupId(groupId);
        setJoinError(null);
        setJoinErrorGroupId(null);
        try {
            await apiRequest<{ data: ApiGroup }>(
                `/groups/${groupId}/join`,
                { method: 'POST' },
                () =>
                    getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                        },
                    })
            );
            navigate(`/groups/${groupId}/members`);
        } catch (err) {
            setJoinErrorGroupId(groupId);
            if (err instanceof ApiError && err.status === 409) {
                setJoinError('You are already in a group.');
            } else if (err instanceof ApiError) {
                setJoinError(`Unable to join group. (${err.status})`);
            } else {
                setJoinError('Unable to join group.');
            }
        } finally {
            setJoiningGroupId(null);
        }
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
                        key={group._id}
                        longitude={group.location.coordinates[0]}
                        latitude={group.location.coordinates[1]}
                    >
                        <MarkerContent className="rounded-full bg-primary/20 p-1">
                            <div className="h-3 w-3 rounded-full bg-primary shadow-sm" />
                        </MarkerContent>
                        <MarkerPopup closeButton>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">{group.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {group.module?.name ?? group.interest ?? 'Interest group'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {group.members.length} members
                                </p>
                                {joinError && joinErrorGroupId === group._id && (
                                    <p className="text-xs text-destructive">{joinError}</p>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    className="mt-2 w-full"
                                    onClick={() => handleJoinGroup(group._id)}
                                    disabled={joiningGroupId === group._id}
                                >
                                    {joiningGroupId === group._id ? 'Joining...' : 'Join group'}
                                </Button>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                ))}
            </Map>

            {/* Top Right Controls: Streak & Profile */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <div className="flex h-10 items-center gap-1.5 rounded-full bg-background/80 px-3 shadow-lg backdrop-blur-md border border-border">
                    <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
                    <span className="text-sm font-bold text-foreground">1</span>
                </div>
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
                <DinoChat onJoinGroup={handleJoinGroup} />
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
                            {moduleOptions.map((module) => (
                                <option key={module} value={module}>
                                    {module}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-3">
                        <Label htmlFor="map-interest-search">Interest search</Label>
                        <form onSubmit={handleInterestSearch} className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    id="map-interest-search"
                                    value={interestQuery}
                                    onChange={(event) => setInterestQuery(event.target.value)}
                                    placeholder="Search interests"
                                />
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    disabled={isInterestSearching}
                                >
                                    {isInterestSearching ? 'Searching...' : 'Search'}
                                </Button>
                            </div>
                            {interestError && (
                                <p className="text-xs text-destructive">
                                    {interestError}
                                </p>
                            )}
                        </form>
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-5">
                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {filteredGroups.length} group
                            {filteredGroups.length === 1 ? '' : 's'} shown
                        </p>
                        {groupsError && (
                            <p className="text-sm text-destructive">
                                {groupsError}
                            </p>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleClearFilters}
                            disabled={isGroupsLoading}
                        >
                            Clear filters
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}