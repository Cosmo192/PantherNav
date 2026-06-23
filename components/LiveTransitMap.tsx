"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Stop, TransitSnapshot, Vehicle } from "@/lib/transit";
import { GSU_CENTER, stopServesRoute } from "@/lib/transit";
import { loadGoogleMaps } from "@/lib/googleMaps";

type LiveTransitMapProps = {
  snapshot: TransitSnapshot | null;
  selectedRouteId?: string;
  onStopSelect: (stop: Stop) => void;
};

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#111827" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#dbeafe" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#172033" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#bfdbfe" }] },
  { featureType: "poi.school", elementType: "geometry", stylers: [{ color: "#10294a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#243044" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1d4ed8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#061426" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7dd3fc" }] }
];

function routeColor(color?: string) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#003366";
}

function busSvg(vehicle: Vehicle) {
  const color = encodeURIComponent(routeColor(vehicle.color));
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="${decodeURIComponent(color)}" stroke="white" stroke-width="3"/>
      <path d="M12 9h14a3 3 0 0 1 3 3v12a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V12a3 3 0 0 1 3-3Z" fill="none" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M9 17h20M14 12v7M24 12v7" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="14" cy="25" r="1.7" fill="white"/>
      <circle cx="24" cy="25" r="1.7" fill="white"/>
    </svg>
  `)}`;
}

function makeInfoContent(title: string, lines: string[], buttonText?: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "google-map-popup";

  const heading = document.createElement("div");
  heading.className = "google-map-popup-title";
  heading.textContent = title;
  wrapper.appendChild(heading);

  lines.forEach((line) => {
    const item = document.createElement("div");
    item.className = "google-map-popup-line";
    item.textContent = line;
    wrapper.appendChild(item);
  });

  if (buttonText) {
    const button = document.createElement("button");
    button.className = "google-map-popup-button";
    button.type = "button";
    button.textContent = buttonText;
    wrapper.appendChild(button);
  }

  return wrapper;
}

export default function LiveTransitMap({ snapshot, selectedRouteId, onStopSelect }: LiveTransitMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");

  const selectedRoute = useMemo(
    () => snapshot?.routes.find((route) => [route.id, route.myid, route.groupId].filter(Boolean).includes(selectedRouteId ?? "")),
    [selectedRouteId, snapshot?.routes]
  );

  const stops = useMemo(
    () => (selectedRoute ? snapshot?.stops.filter((stop) => stopServesRoute(stop, selectedRoute)) ?? [] : snapshot?.stops ?? []),
    [selectedRoute, snapshot?.stops]
  );

  const vehicles = useMemo(
    () => (selectedRouteId ? snapshot?.vehicles.filter((vehicle) => vehicle.routeId === selectedRouteId) ?? [] : snapshot?.vehicles ?? []),
    [selectedRouteId, snapshot?.vehicles]
  );

  useEffect(() => {
    let mounted = true;

    loadGoogleMaps().then((ready) => {
      if (!mounted) return;

      if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        setLoadState("missing-key");
        return;
      }

      if (!ready || !window.google?.maps || !mapNodeRef.current) {
        setLoadState("error");
        return;
      }

      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(mapNodeRef.current, {
          center: GSU_CENTER,
          zoom: 15,
          clickableIcons: true,
          disableDefaultUI: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          styles: mapStyles
        });
        infoWindowRef.current = new window.google.maps.InfoWindow();
      }

      setLoadState("ready");
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const google = window.google;
    if (loadState !== "ready" || !google?.maps || !mapRef.current) return;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];

    const campusMarker = new google.maps.Marker({
      map: mapRef.current,
      position: GSU_CENTER,
      title: "Georgia State University",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#CC0000",
        fillOpacity: 1,
        scale: 8,
        strokeColor: "#ffffff",
        strokeWeight: 2
      }
    });
    markerRefs.current.push(campusMarker);

    stops.forEach((stop) => {
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: stop.latitude, lng: stop.longitude },
        title: stop.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#003366",
          fillOpacity: 1,
          scale: 6,
          strokeColor: "#ffffff",
          strokeWeight: 2
        }
      });

      marker.addListener("click", () => {
        const content = makeInfoContent(stop.name, ["Campus shuttle stop"], "Show arrivals");
        content.querySelector("button")?.addEventListener("click", () => onStopSelect(stop));
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open({ anchor: marker, map: mapRef.current });
      });

      markerRefs.current.push(marker);
    });

    vehicles.forEach((vehicle) => {
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: vehicle.latitude, lng: vehicle.longitude },
        title: `${vehicle.name} - ${vehicle.routeName}`,
        icon: {
          url: busSvg(vehicle),
          scaledSize: new google.maps.Size(38, 38),
          anchor: new google.maps.Point(19, 19)
        },
        zIndex: 10
      });

      marker.addListener("click", () => {
        infoWindowRef.current.setContent(
          makeInfoContent(vehicle.name, [vehicle.routeName, `Heading ${Math.round(vehicle.calculatedCourse || 0)} deg`])
        );
        infoWindowRef.current.open({ anchor: marker, map: mapRef.current });
      });

      markerRefs.current.push(marker);
    });

    return () => {
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = [];
    };
  }, [loadState, onStopSelect, stops, vehicles]);

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden rounded-lg border border-sky-300/15 bg-gsu-panel shadow-glow">
      <div ref={mapNodeRef} className="google-map h-full min-h-[460px]" />

      {loadState !== "ready" && (
        <div className="absolute inset-0 grid place-items-center bg-gsu-panel px-6 text-center text-sm text-slate-300">
          {loadState === "missing-key"
            ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local to load Google Maps."
            : loadState === "error"
              ? "Google Maps could not load. Check that Maps JavaScript API is enabled for your key."
              : "Loading Google Maps"}
        </div>
      )}
    </div>
  );
}
