import { create } from 'zustand';

interface MapState {
    // MapLibre uses [Lng, Lat]
    center: [number, number];
    zoom: number;
    setMapState: (center: [number, number], zoom: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
    // Default: London [Lng, Lat]
    center: [- 1.57566, 54.77676],
    zoom: 12,
    setMapState: (center, zoom) => set({ center, zoom }),
}));