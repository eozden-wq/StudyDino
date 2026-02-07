import { create } from 'zustand';

interface MapState {
    // MapLibre uses [Lng, Lat]
    center: [number, number];
    zoom: number;
    setMapState: (center: [number, number], zoom: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
    // Default: London [Lng, Lat]
    center: [-0.1276, 51.5072],
    zoom: 12,
    setMapState: (center, zoom) => set({ center, zoom }),
}));