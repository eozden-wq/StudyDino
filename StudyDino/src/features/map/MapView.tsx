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
import { ChevronDown, ChevronUp, Search, User } from 'lucide-react';
import { Link } from 'react-router';
import { useMapStore } from '@/store/map-store';
import type { Map as MapLibreInstance } from 'maplibre-gl';
// import dinoPng from '@/assets/dinosaur.png'
import { DinoChat } from '@/components/DinoChat';

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

export default function MapView() {
    const { center, zoom, setMapState } = useMapStore();
    const mapRef = useRef<MapLibreInstance | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [nameQuery, setNameQuery] = useState('');
    const [selectedModule, setSelectedModule] = useState(MODULE_OPTIONS[0]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

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

    return (
        <div className="relative h-full w-full">
            <Map
                ref={handleMapRef}
                center={[center[0], center[1]]}
                zoom={zoom}
                className="h-full w-full"
            >
                <MapControls position="bottom-right" showZoom={false} showCompass={false} />
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

            <div className="absolute top-4 right-4 z-10">
                <Link to="/profile">
                    <Button variant="secondary" size="icon" className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0">
                        <User className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="absolute bottom-4 right-4 z-10">
                <DinoChat />
            </div>

            <Card className="absolute top-4 left-4 z-10 w-[min(92vw,380px)] max-h-[70vh] overflow-hidden">
                <CardHeader className="border-b">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Find groups</CardTitle>
                            <CardDescription>
                                Filter the map by name, module, or interest.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsFiltersOpen((prev) => !prev)}
                            aria-expanded={isFiltersOpen}
                            aria-controls="map-filters"
                        >
                            {isFiltersOpen ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <div
                    id="map-filters"
                    className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out md:opacity-100 md:translate-y-0 md:max-h-[70vh] md:pointer-events-auto ${isFiltersOpen
                        ? "max-h-[70vh] opacity-100 translate-y-0 pointer-events-auto"
                        : "max-h-0 opacity-0 -translate-y-2 pointer-events-none md:max-h-[70vh] md:opacity-100 md:translate-y-0 md:pointer-events-auto"
                        }`}
                >
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
                </div>
            </Card>
        </div>
    );
}