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
  gpsCoords?: [number, number] | null;
}

const NIGERIA_CENTER_FALLBACK: [number, number] = [9.082, 8.6753];

const NIGERIA_BOUNDS = L.latLngBounds(L.latLng(4.0, 2.5), L.latLng(14.0, 15.0));

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

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (coords: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function LiveTrackerMap({
  stateName,
  lgaName,
  gpsCoords,
}: LiveTrackerMapProps) {
  const [customClickCoords, setCustomClickCoords] = useState<
    [number, number] | null
  >(null);

  // Track parameters to know if the dropdown filters changed since the last user click
  const [lastFilterKey, setLastFilterKey] = useState<string>(
    `${stateName}-${lgaName}-${gpsCoords?.[0] || 0}`,
  );

  // Derived current key string representing current props setup
  const currentFilterKey = `${stateName}-${lgaName}-${gpsCoords?.[0] || 0}`;

  let mapCenter: [number, number] = NIGERIA_CENTER_FALLBACK;
  let zoomLevel = 6;
  let isLocationSelected = false;

  // Priority 1: User requested device GPS coordinates location
  if (gpsCoords) {
    mapCenter = gpsCoords;
    zoomLevel = 14;
    isLocationSelected = true;
  }
  // Priority 2: Standard dropdown selector navigation filtering
  else if (stateName) {
    const internalStates = State.getStatesOfCountry("NG");
    const normalizedSearchState = stateName
      .toLowerCase()
      .trim()
      .replace(" state", "");

    const matchedState = internalStates.find(
      (s) =>
        s.name.toLowerCase().trim().replace(" state", "") ===
        normalizedSearchState,
    );

    if (matchedState) {
      isLocationSelected = true;

      if (lgaName) {
        const cities = City.getCitiesOfState("NG", matchedState.isoCode);
        const cleanSearchLga = lgaName
          .toLowerCase()
          .trim()
          .replace(/[-\s]/g, "");

        const matchedCity = cities.find((c) => {
          const cleanLibraryCity = c.name
            .toLowerCase()
            .trim()
            .replace(/[-\s]/g, "");
          return (
            cleanLibraryCity.includes(cleanSearchLga) ||
            cleanSearchLga.includes(cleanLibraryCity)
          );
        });

        if (matchedCity && matchedCity.latitude && matchedCity.longitude) {
          mapCenter = [
            parseFloat(matchedCity.latitude),
            parseFloat(matchedCity.longitude),
          ];
          zoomLevel = 12;
        } else if (matchedState.latitude && matchedState.longitude) {
          mapCenter = [
            parseFloat(matchedState.latitude),
            parseFloat(matchedState.longitude),
          ];
          zoomLevel = 9;
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

  // Determine if a custom click pin is valid or if the user updated filters afterward
  const dynamicClickCoords =
    currentFilterKey === lastFilterKey ? customClickCoords : null;

  const handleManualMapClick = (coords: [number, number]) => {
    // Keep our filter key value matched to current props on manual user interaction clicks
    setLastFilterKey(currentFilterKey);
    setCustomClickCoords(coords);
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        minZoom={6}
        maxBounds={NIGERIA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", background: "#f4f4f5" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Custom click handler updates click coordinates along with current filter state context info */}
        <MapClickHandler onMapClick={handleManualMapClick} />

        <MapRecenterController coordinates={mapCenter} zoomLevel={zoomLevel} />

        {/* Display Primary Filter/GPS Tracking Marker Pin */}
        {isLocationSelected && !dynamicClickCoords && (
          <Marker
            key={`focused-${mapCenter[0]}-${mapCenter[1]}`}
            position={mapCenter}
          >
            <Popup>
              <div className="font-sans p-1">
                {gpsCoords ? (
                  <>
                    <p className="font-bold text-sm text-emerald-700">
                      Your Current Location
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                      Lat: {gpsCoords[0].toFixed(4)}, Lng:{" "}
                      {gpsCoords[1].toFixed(4)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm text-emerald-700">
                      {stateName}
                    </p>
                    {lgaName && (
                      <p className="text-xs font-semibold text-zinc-600 mt-0.5">
                        LGA Focus: {lgaName}
                      </p>
                    )}
                  </>
                )}
                <p className="text-[10px] text-zinc-400 mt-2 border-t pt-1 border-zinc-100">
                  Monitoring Active Area
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Display Manual User Selection Surface Tap Drop Markers */}
        {dynamicClickCoords && (
          <Marker
            key={`click-${dynamicClickCoords[0]}-${dynamicClickCoords[1]}`}
            position={dynamicClickCoords}
          >
            <Popup>
              <div className="font-sans p-1">
                <p className="font-bold text-sm text-zinc-800">
                  Custom Position Drop
                </p>
                <p className="text-xs font-mono text-zinc-500 mt-1 bg-zinc-100 p-1 rounded border">
                  Lat: {dynamicClickCoords[0].toFixed(4)} <br />
                  Lng: {dynamicClickCoords[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
