"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

interface IncidentMarker {
  state: string;
  lga: string;
  month: string;
  year: number;
  incidentCount: number;
  reportedCasualties: number;
  alertType: string;
  coordinates: [number, number];
}

interface LiveTrackerMapProps {
  stateName: string;
  lgaName: string;
  eventsList: IncidentMarker[];
  onMapLocationSelect?: (stateCode: string, lgaName: string) => void;
  cardFocusedCoords: [number, number] | null;
  theme: "light" | "dark"; // Captures current color environment parameters
}

const NIGERIA_CENTER_FALLBACK: [number, number] = [9.082, 8.6753];
const NIGERIA_BOUNDS = L.latLngBounds(L.latLng(4.0, 2.5), L.latLng(14.0, 15.0));

function MapRecenterController({
  coordinates,
  zoomLevel,
  forcedFocus,
}: {
  coordinates: [number, number];
  zoomLevel: number;
  forcedFocus: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (forcedFocus) {
      map.flyTo(forcedFocus, 14, { animate: true, duration: 1.5 });
    } else {
      map.flyTo(coordinates, zoomLevel, { animate: true, duration: 1.2 });
    }
  }, [coordinates, zoomLevel, forcedFocus, map]);
  return null;
}

function MapClickHandler({
  onLocationLocate,
}: {
  onLocationLocate: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationLocate(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LiveTrackerMap({
  stateName,
  lgaName,
  eventsList,
  onMapLocationSelect,
  cardFocusedCoords,
  theme,
}: LiveTrackerMapProps) {
  let mapCenter: [number, number] = NIGERIA_CENTER_FALLBACK;
  let zoomLevel = 6;

  if (stateName && eventsList.length > 0) {
    mapCenter = eventsList[0].coordinates;
    zoomLevel = lgaName ? 11 : 8;
  }

  const handleReverseLookup = (lat: number, lng: number) => {};

  const createCustomClusterIcon = (cluster: any) => {
    const childCount = cluster.getChildCount();

    return L.divIcon({
      html: `
        <div style="position: relative; width: 40px; height: 40px; display: flex; items-center; justify-content: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#10b981" stroke="#047857" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="4.5" fill="#047857"/>
          </svg>
          <span style="position: absolute; top: 7px; left: 50%; transform: translateX(-50%); color: #ffffff; font-family: monospace; font-size: 11px; font-weight: bold; text-shadow: 0px 1px 2px rgba(0,0,0,0.8);">
            ${childCount}
          </span>
        </div>
      `,
      className: "custom-leaflet-inscribed-cluster",
      iconSize: L.point(40, 40),
      iconAnchor: L.point(20, 40),
    });
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        minZoom={6}
        maxBounds={NIGERIA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{
          height: "100%",
          width: "100%",
          background: theme === "dark" ? "#0c0c0e" : "#e5e7eb",
        }}
      >
        {/* Dynamic CartoDB Tile Provider Swap based on active theme choice */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            theme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          }
        />

        <MapClickHandler onLocationLocate={handleReverseLookup} />

        <MapRecenterController
          coordinates={mapCenter}
          zoomLevel={zoomLevel}
          forcedFocus={cardFocusedCoords}
        />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          iconCreateFunction={createCustomClusterIcon}
          key={`cluster-layer-${theme}`} // Re-mounts layer smoothly when theme toggles
        >
          {eventsList.map((incident, idx) => {
            const jitterLat = incident.coordinates[0] + Math.sin(idx) * 0.007;
            const jitterLng = incident.coordinates[1] + Math.cos(idx) * 0.007;

            return (
              <Marker key={`incident-${idx}`} position={[jitterLat, jitterLng]}>
                <Popup>
                  <div className="p-1 font-sans text-zinc-900 space-y-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        incident.alertType === "Armed Clashes & Attacks"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {incident.alertType}
                    </span>
                    <p className="font-bold text-xs pt-1">
                      {incident.lga}, {incident.state}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      Timeline Log: {incident.month} {incident.year}
                    </p>
                    <div className="text-[11px] font-mono border-t pt-1 mt-1 flex gap-3">
                      <div>
                        Incidents: <strong>{incident.incidentCount}</strong>
                      </div>
                      <div>
                        Casualties:{" "}
                        <strong className="text-red-600">
                          {incident.reportedCasualties}
                        </strong>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
