"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useRef } from "react";
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
  onMapLocationSelect?: (lat: number, lng: number) => void;
  cardFocusedCoords: [number, number] | null;
  theme: "light" | "dark";
}

const NIGERIA_CENTER: [number, number] = [9.082, 8.6753];
const NIGERIA_BOUNDS = L.latLngBounds(L.latLng(4.0, 2.5), L.latLng(14.0, 15.0));

// ─── Selected-location icon ───────────────────────────────────────────────────
// Distinct from the emerald incident-cluster pins so a clicked / geolocated
// point is unmistakably visible on the map. Previously nothing was rendered
// here at all, so "use your location" / map clicks produced no visible marker
// even when the coordinates were correctly captured.

const selectedLocationIcon = L.divIcon({
  html: `
    <div style="position:relative;width:34px;height:34px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#3b82f6;opacity:0.25;
                   animation:tracker-pulse 1.6s ease-out infinite;"></span>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
           xmlns="http://www.w3.org/2000/svg"
           style="position:relative;filter:drop-shadow(0px 2px 3px rgba(0,0,0,0.4));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="#3b82f6" stroke="#1d4ed8" stroke-width="1.5"/>
        <circle cx="12" cy="9" r="3.2" fill="#fff"/>
      </svg>
    </div>
    <style>
      @keyframes tracker-pulse {
        0% { transform: scale(0.4); opacity: 0.45; }
        100% { transform: scale(1.4); opacity: 0; }
      }
    </style>`,
  className: "custom-leaflet-selected-location",
  iconSize: L.point(34, 34),
  iconAnchor: L.point(17, 34),
});

// ─── MapRecenterController ────────────────────────────────────────────────────
// FIX: lastCenter initialised to null so the very first center change always
// triggers flyTo. Previously it was seeded with `center` so the first
// selection was silently swallowed.

function MapRecenterController({
  center,
  zoom,
  cardFocusedCoords,
}: {
  center: [number, number];
  zoom: number;
  cardFocusedCoords: [number, number] | null;
}) {
  const map = useMap();

  // Tracks the last cardFocusedCoords we acted on — reference equality check
  // means a new [lat,lng] array always triggers even if numbers are the same.
  const lastFocusRef = useRef<[number, number] | null>(null);

  // Priority path: explicit card / event focus
  useEffect(() => {
    if (!cardFocusedCoords) return;
    if (cardFocusedCoords === lastFocusRef.current) return;
    lastFocusRef.current = cardFocusedCoords;
    map.flyTo(cardFocusedCoords, 13, { animate: true, duration: 1.4 });
  }, [cardFocusedCoords, map]);

  // Secondary path: filter dropdown changed the derived center.
  // Use a serialised string so we compare by value, not reference.
  const lastCenterKey = useRef<string>("");
  useEffect(() => {
    // Don't fight with an active explicit focus
    if (cardFocusedCoords) return;
    const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;
    if (key === lastCenterKey.current) return;
    lastCenterKey.current = key;
    map.flyTo(center, zoom, { animate: true, duration: 1.2 });
  }, [center, zoom, cardFocusedCoords, map]);

  return null;
}

// ─── MapClickHandler ──────────────────────────────────────────────────────────

function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Cluster icon ─────────────────────────────────────────────────────────────

function buildClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg"
             style="filter:drop-shadow(0px 3px 4px rgba(0,0,0,0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="#10b981" stroke="#047857" stroke-width="1.5"/>
          <circle cx="12" cy="9" r="4.5" fill="#047857"/>
        </svg>
        <span style="position:absolute;top:7px;left:50%;transform:translateX(-50%);
                     color:#fff;font-family:monospace;font-size:11px;font-weight:700;
                     text-shadow:0 1px 2px rgba(0,0,0,0.8);">${count}</span>
      </div>`,
    className: "custom-leaflet-cluster",
    iconSize: L.point(40, 40),
    iconAnchor: L.point(20, 40),
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LiveTrackerMap({
  stateName,
  lgaName,
  eventsList,
  onMapLocationSelect,
  cardFocusedCoords,
  theme,
}: LiveTrackerMapProps) {
  // Derive the filter-driven centre. Falls back to Nigeria centre when no
  // state is selected or data hasn't arrived yet.
  let mapCenter: [number, number] = NIGERIA_CENTER;
  let zoomLevel = 6;

  if (stateName && eventsList.length > 0) {
    mapCenter = eventsList[0].coordinates;
    zoomLevel = lgaName ? 11 : 8;
  }

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={NIGERIA_CENTER}
        zoom={6}
        minZoom={6}
        maxBounds={NIGERIA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{
          height: "100%",
          width: "100%",
          background: theme === "dark" ? "#0c0c0e" : "#e5e7eb",
        }}
      >
        {/*
          key={theme} forces react-leaflet to unmount/remount this layer when
          the theme flips. Relying on the `url` prop alone doesn't reliably
          repaint the tile layer in place — this is the same remount trick
          already used below for MarkerClusterGroup, just missing here, which
          is why toggling the theme button never actually changed the tiles.
        */}
        <TileLayer
          key={`tiles-${theme}`}
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            theme === "dark"
              ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_KEY}`
              : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_KEY}`
          }
        />

        <MapClickHandler onLocationSelect={onMapLocationSelect} />

        <MapRecenterController
          center={mapCenter}
          zoom={zoomLevel}
          cardFocusedCoords={cardFocusedCoords}
        />

        {/* Marker for a clicked point or "Use Your Location" result. Previously
            nothing rendered here at all, so even when the coordinate was
            captured correctly there was no visible confirmation on the map. */}
        {cardFocusedCoords && (
          <Marker
            position={cardFocusedCoords}
            icon={selectedLocationIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="p-1 font-sans text-zinc-900 text-xs space-y-0.5 min-w-[140px]">
                <p className="font-bold">Selected location</p>
                <p className="font-mono text-[10px] text-zinc-500">
                  {cardFocusedCoords[0].toFixed(4)},{" "}
                  {cardFocusedCoords[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* key forces cluster layer remount on theme change */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          iconCreateFunction={buildClusterIcon}
          key={`cluster-${theme}`}
        >
          {eventsList.map((incident, idx) => {
            // Deterministic per-marker jitter so overlapping points spread out
            const jLat =
              incident.coordinates[0] + Math.sin(idx * 1.618) * 0.007;
            const jLng =
              incident.coordinates[1] + Math.cos(idx * 1.618) * 0.007;

            return (
              <Marker key={`inc-${idx}`} position={[jLat, jLng]}>
                <Popup>
                  <div className="p-1 font-sans text-zinc-900 space-y-1 min-w-[180px]">
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
                      {incident.month} {incident.year}
                    </p>
                    <div className="text-[11px] font-mono border-t pt-1 mt-1 flex gap-3">
                      <span>
                        Incidents: <strong>{incident.incidentCount}</strong>
                      </span>
                      <span>
                        Casualties:{" "}
                        <strong className="text-red-600">
                          {incident.reportedCasualties}
                        </strong>
                      </span>
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
