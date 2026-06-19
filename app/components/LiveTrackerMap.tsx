"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { State, City } from "country-state-city";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

interface LiveTrackerMapProps {
  stateName: string;
  lgaName: string;
}

const NIGERIA_CENTER_FALLBACK: [number, number] = [9.082, 8.6753];

// 1. Define a strict bounding box around Nigeria [South-West corner, North-East corner]
// This prevents the user from panning away to other countries or oceans.
const NIGERIA_BOUNDS = L.latLngBounds(
  L.latLng(4.0, 2.5), // Southern/Western limits (near Lagos/ocean borders)
  L.latLng(14.0, 15.0), // Northern/Eastern limits (near Lake Chad/Sokoto borders)
);

// Companion component to smoothly pan and zoom the map camera
function MapRecenterController({
  coordinates,
  zoomLevel,
}: {
  coordinates: [number, number];
  zoomLevel: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(coordinates, zoomLevel, { animate: true, duration: 1.2 });
  }, [coordinates, zoomLevel, map]);

  return null;
}

// 2. NEW COMPONENT: Handles user clicks directly on the map surface
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (coords: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      // Captures the exact point where the user clicked
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function LiveTrackerMap({
  stateName,
  lgaName,
}: LiveTrackerMapProps) {
  // State to hold custom point coordinates clicked by the user
  const [customClickCoords, setCustomClickCoords] = useState<
    [number, number] | null
  >(null);

  // Calculate default coordinates dynamically on the fly during render
  let mapCenter: [number, number] = NIGERIA_CENTER_FALLBACK;
  let zoomLevel = 6;
  let isLocationSelected = false;

  if (stateName) {
    const internalStates = State.getStatesOfCountry("NG");
    const matchedState = internalStates.find(
      (s) =>
        s.name.toLowerCase().replace(" state", "") === stateName.toLowerCase(),
    );

    if (matchedState) {
      isLocationSelected = true;

      if (lgaName) {
        const cities = City.getCitiesOfState("NG", matchedState.isoCode);
        const matchedCity = cities.find(
          (c) => c.name.toLowerCase() === lgaName.toLowerCase(),
        );

        if (matchedCity && matchedCity.latitude && matchedCity.longitude) {
          mapCenter = [
            parseFloat(matchedCity.latitude),
            parseFloat(matchedCity.longitude),
          ];
          zoomLevel = 11;
        }
      } else if (matchedState.latitude && matchedState.longitude) {
        mapCenter = [
          parseFloat(matchedState.latitude),
          parseFloat(matchedState.longitude),
        ];
        zoomLevel = 9;
      }
    }
  }

  // Clear any custom clicked points if the top sidebar filters change
  useEffect(() => {
    setCustomClickCoords(null);
  }, [stateName, lgaName]);

  const handleMapSurfaceClick = (coords: [number, number]) => {
    setCustomClickCoords(coords);
    console.log(
      `User clicked map coordinates: Latitude: ${coords[0]}, Longitude: ${coords[1]}`,
    );
    // Tip: You can pass this handler up to your parent component to trigger incident reports!
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        minZoom={6} // Restricts zooming out too far (stops world map from showing)
        maxBounds={NIGERIA_BOUNDS} // Locks map dragging strictly inside Nigeria's limits
        maxBoundsViscosity={1.0} // 1.0 means completely solid walls—users cannot drag past borders at all
        style={{ height: "100%", width: "100%", background: "#f4f4f5" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Listens for map surface tap gestures */}
        <MapClickHandler onMapClick={handleMapSurfaceClick} />

        {/* Animates map camera shifts when sidebar choices change */}
        <MapRecenterController coordinates={mapCenter} zoomLevel={zoomLevel} />

        {/* PIN A: Drop filter pin based on Sidebar Selection Dropdowns */}
        {isLocationSelected && !customClickCoords && (
          <Marker
            key={`filter-${mapCenter[0]}-${mapCenter[1]}`}
            position={mapCenter}
          >
            <Popup>
              <div className="font-sans p-1">
                <p className="font-bold text-sm text-emerald-700">
                  {stateName}
                </p>
                {lgaName && (
                  <p className="text-xs font-semibold text-zinc-600 mt-0.5">
                    LGA: {lgaName}
                  </p>
                )}
                <p className="text-[10px] text-zinc-400 mt-2 border-t pt-1 border-zinc-100">
                  Filtered Region Focus
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* PIN B: Drop a custom marker exactly where the user explicitly clicked */}
        {customClickCoords && (
          <Marker
            key={`click-${customClickCoords[0]}-${customClickCoords[1]}`}
            position={customClickCoords}
          >
            <Popup>
              <div className="font-sans p-1">
                <p className="font-bold text-sm text-zinc-800">
                  Selected Custom Location
                </p>
                <p className="text-xs font-mono text-zinc-500 mt-1 bg-zinc-100 p-1 rounded border">
                  Lat: {customClickCoords[0].toFixed(4)} <br />
                  Lng: {customClickCoords[1].toFixed(4)}
                </p>
                <p className="text-[10px] text-emerald-600 font-bold mt-2">
                  Ready to map local security alerts...
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
