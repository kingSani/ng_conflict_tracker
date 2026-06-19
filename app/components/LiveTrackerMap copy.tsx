"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

interface LiveTrackerMapProps {
  state: string;
  lga: string;
}

const ALL_NIGERIAN_STATES_COORDINATES: Record<string, [number, number]> = {
  Abia: [5.5267, 7.4898],
  Adamawa: [9.3265, 12.4371],
  "Akwa Ibom": [5.0333, 7.9167],
  Anambra: [6.2106, 7.0699],
  Bauchi: [10.3158, 9.8442],
  Bayelsa: [4.7731, 6.0594],
  Benue: [7.3333, 8.75],
  Borno: [11.8311, 13.151],
  "Cross River": [5.9631, 8.3304],
  Delta: [5.5442, 5.8922],
  Ebonyi: [6.2649, 8.0137],
  Edo: [6.6342, 5.9304],
  Ekiti: [7.6333, 5.2167],
  Enugu: [6.4584, 7.5083],
  "FCT - Abuja": [9.0765, 7.3986],
  Gombe: [10.2833, 11.1667],
  Imo: [5.4854, 7.0357],
  Jigawa: [12.15, 9.5],
  Kaduna: [10.5105, 7.4165],
  Kano: [12.0022, 8.592],
  Katsina: [12.9856, 7.6171],
  Kebbi: [11.5, 4.0],
  Kogi: [7.8004, 6.7405],
  Kwara: [8.5, 4.55],
  Lagos: [6.5244, 3.3792],
  Nasarawa: [8.5, 8.1667],
  Niger: [10.0, 6.0],
  Ogun: [7.1604, 3.3478],
  Ondo: [7.25, 5.2],
  Osun: [7.5, 4.5],
  Oyo: [8.0, 4.0],
  Plateau: [9.2182, 9.5179],
  Rivers: [4.8156, 7.0498],
  Sokoto: [13.0622, 5.2339],
  Taraba: [8.0, 10.5],
  Yobe: [12.0, 11.5],
  Zamfara: [12.1222, 6.2236],
};

const NIGERIA_DEFAULT_CENTER: [number, number] = [9.082, 8.6753];

function MapRecenterController({ state }: { state: string }) {
  const map = useMap();

  useEffect(() => {
    const targetCoords = ALL_NIGERIAN_STATES_COORDINATES[state];
    if (targetCoords) {
      map.flyTo(targetCoords, 9, { animate: true, duration: 1.2 });
    } else {
      map.flyTo(NIGERIA_DEFAULT_CENTER, 6, { animate: true, duration: 1.0 });
    }
  }, [state, map]);

  return null;
}

export default function LiveTrackerMap({ state, lga }: LiveTrackerMapProps) {
  const initialCenter =
    ALL_NIGERIAN_STATES_COORDINATES[state] || NIGERIA_DEFAULT_CENTER;
  const initialZoom = state ? 9 : 6;

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        zoomControl={true} // Re-enabled navigation controls since layout has space
        style={{ height: "100%", width: "100%", background: "#f4f4f5" }}
      >
        {/* CHANGED: Highly legible, clean light-themed mapping tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapRecenterController state={state} />

        {state && ALL_NIGERIAN_STATES_COORDINATES[state] && (
          <Marker position={ALL_NIGERIAN_STATES_COORDINATES[state]}>
            <Popup>
              <div className="font-sans p-1">
                <p className="font-bold text-sm text-emerald-700">{state}</p>
                {lga && (
                  <p className="text-xs font-semibold text-zinc-600 mt-0.5">
                    LGA Area: {lga}
                  </p>
                )}
                <p className="text-[11px] text-zinc-400 mt-2 border-t pt-1 border-zinc-100">
                  Status: Tracking Updates Active
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
