"use client";

import L from "leaflet";
import { Bus, MapPin } from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, CircleMarker } from "react-leaflet";
import type { Stop, TransitSnapshot, Vehicle } from "@/lib/transit";
import { GSU_CENTER, stopServesRoute } from "@/lib/transit";

type LiveTransitMapProps = {
  snapshot: TransitSnapshot | null;
  selectedRouteId?: string;
  onStopSelect: (stop: Stop) => void;
};

function routeColor(color?: string) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#003366";
}

function busIcon(vehicle: Vehicle) {
  const html = `<div class="bus-marker" style="background:${routeColor(vehicle.color)}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/><path d="M16 6v6"/><path d="M6 18h.01"/><path d="M18 18h.01"/><path d="M6 2h12a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V4a2 2 0 0 1 2-2Z"/><path d="M4 10h16"/><path d="m6 20-2 2"/><path d="m18 20 2 2"/>
    </svg>
  </div>`;

  return L.divIcon({
    className: "",
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14]
  });
}

function stopIcon() {
  return L.divIcon({
    className: "",
    html: '<div class="stop-marker"></div>',
    iconSize: [13, 13],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });
}

export default function LiveTransitMap({ snapshot, selectedRouteId, onStopSelect }: LiveTransitMapProps) {
  const selectedRoute = snapshot?.routes.find((route) =>
    [route.id, route.myid, route.groupId].filter(Boolean).includes(selectedRouteId ?? "")
  );

  const stops = selectedRoute
    ? snapshot?.stops.filter((stop) => stopServesRoute(stop, selectedRoute)) ?? []
    : snapshot?.stops ?? [];

  const vehicles = selectedRouteId
    ? snapshot?.vehicles.filter((vehicle) => vehicle.routeId === selectedRouteId) ?? []
    : snapshot?.vehicles ?? [];

  return (
    <div className="h-full min-h-[460px] overflow-hidden rounded-lg border border-sky-300/15 bg-gsu-panel shadow-glow">
      <MapContainer
        center={[GSU_CENTER.lat, GSU_CENTER.lng]}
        zoom={15}
        scrollWheelZoom
        className="h-full min-h-[460px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CircleMarker
          center={[GSU_CENTER.lat, GSU_CENTER.lng]}
          radius={7}
          pathOptions={{ color: "#CC0000", fillColor: "#CC0000", fillOpacity: 0.8 }}
        >
          <Popup>
            <strong>Georgia State University</strong>
          </Popup>
        </CircleMarker>

        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={stopIcon()}
            eventHandlers={{
              click: () => onStopSelect(stop)
            }}
          >
            <Popup>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <MapPin size={14} />
                  {stop.name}
                </div>
                <button
                  className="rounded-md bg-gsu-blue px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => onStopSelect(stop)}
                >
                  Show arrivals
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {vehicles.map((vehicle) => (
          <Marker key={vehicle.id} position={[vehicle.latitude, vehicle.longitude]} icon={busIcon(vehicle)}>
            <Popup>
              <div className="min-w-44 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Bus size={14} />
                  {vehicle.name}
                </div>
                <div className="text-sm text-slate-300">{vehicle.routeName}</div>
                <div className="text-xs text-slate-400">Heading {Math.round(vehicle.calculatedCourse || 0)} deg</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
