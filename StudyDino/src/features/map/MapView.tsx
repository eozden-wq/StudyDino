import { useRef, useCallback, useEffect, useState } from 'react';
import { Map, MapControls } from '@/components/ui/map'; // Your mapcn import
import { Button } from '@/components/ui/button';
import { Search, User } from 'lucide-react';
import { Link } from 'react-router';
import { useMapStore } from '@/store/map-store';
import type { Map as MapLibreInstance } from 'maplibre-gl';

export default function MapView() {
    const { center, zoom, setMapState } = useMapStore();
    const mapRef = useRef<MapLibreInstance | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

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

    return (
        <div className="relative h-full w-full">
            <Map
                ref={handleMapRef}
                center={[center[0], center[1]]}
                zoom={zoom}
                className="h-full w-full"
            >
                <MapControls position="bottom-right" showZoom={false} showCompass={false} />
            </Map>

            <div className="absolute top-4 left-4 z-10">
                <Link to="/search">
                    <Button variant="secondary" size="icon" className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0">
                        <Search className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="absolute top-4 right-4 z-10">
                <Link to="/profile">
                    <Button variant="secondary" size="icon" className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0">
                        <User className="h-5 w-5" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}