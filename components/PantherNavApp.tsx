"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  ChevronDown,
  Clock3,
  Compass,
  Footprints,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Route as RouteIcon,
  Signpost,
} from "lucide-react";
import { gsuBounds, loadGoogleMaps } from "@/lib/googleMaps";
import {
  buildGoogleSearchLink,
  buildGoogleWalkingLink,
  CAMPUS_LOCATIONS,
  findRankedRoutes,
  formatArrival,
  formatMiles,
  GSU_CENTER,
  LocationChoice,
  milesBetween,
  RouteOption,
  stopCoordinate,
  Stop,
  timeAfter,
  TransitSnapshot,
  vehiclesForRoute
} from "@/lib/transit";

const LiveTransitMap = dynamic(() => import("@/components/LiveTransitMap"), {
  ssr: false,
  loading: () => <div className="grid min-h-[460px] place-items-center rounded-lg border border-sky-300/15 bg-gsu-panel">Loading map</div>
});

type TabId = "routes" | "arrivals" | "map";

const tabs: Array<{ id: TabId; label: string; icon: typeof RouteIcon }> = [
  { id: "routes", label: "Route Finder", icon: RouteIcon },
  { id: "arrivals", label: "Arrivals", icon: Clock3 },
  { id: "map", label: "Live Map", icon: Map }
];

function resolveChoice(value: string, stops: Stop[]): LocationChoice {
  const normalized = value.trim().toLowerCase();
  const campus = CAMPUS_LOCATIONS.find((item) => item.label.toLowerCase() === normalized);
  if (campus) return campus;

  const stop = stops.find((item) => item.name.toLowerCase() === normalized);
  if (stop) return { label: stop.name, coordinate: stopCoordinate(stop) };

  return { label: value || "Georgia State University", coordinate: GSU_CENTER };
}

function PlaceInput({
  id,
  label,
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  stops
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (choice: LocationChoice) => void;
  placeholder: string;
  stops: Stop[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const options = Array.from(new Set([value, ...CAMPUS_LOCATIONS.map((item) => item.label), ...stops.slice(0, 24).map((stop) => stop.name)])).filter(Boolean);

  useEffect(() => {
    let autocomplete: any;
    let listener: any;

    loadGoogleMaps().then((ready) => {
      const google = (window as any).google;
      if (!ready || !inputRef.current || !google?.maps?.places) return;

      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ["name", "formatted_address", "geometry"],
        bounds: gsuBounds(),
        strictBounds: false
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place?.geometry?.location;
        if (!location) return;
        const label = place.name || place.formatted_address || inputRef.current?.value || "Selected location";
        onChange(label);
        onPlaceSelect?.({
          label,
          coordinate: {
            lat: location.lat(),
            lng: location.lng()
          }
        });
      });
    });

    return () => {
      listener?.remove?.();
    };
  }, [onChange, onPlaceSelect]);

  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-sky-300/15 bg-black/35 px-3 py-2.5 focus-within:border-sky-300/45">
        <Search size={18} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          list={`${id}-choices`}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        <datalist id={`${id}-choices`}>
          {options.map((option) => (
            <option key={`${id}-${option}`} value={option} />
          ))}
        </datalist>
      </div>
    </label>
  );
}

function RouteCard({ option }: { option: RouteOption }) {
  const [expanded, setExpanded] = useState(false);
  const pickup = timeAfter(option.waitMinutes);
  const dropoff = timeAfter(option.waitMinutes + option.rideMinutes);

  return (
    <article className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
      <button className="grid w-full gap-4 text-left" onClick={() => setExpanded((current) => !current)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-black text-white"
              style={{ backgroundColor: option.route.color }}
            >
              {option.route.shortName?.slice(0, 3) || "GSU"}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">{option.route.name}</h3>
              <p className="text-sm text-slate-400">{option.activeBuses} active buses</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-right">
            <div>
              <div className="text-lg font-black text-white">{option.totalMinutes} min</div>
              <div className="text-xs text-slate-400">Picks up {pickup}</div>
            </div>
            <ChevronDown className={`text-slate-400 transition ${expanded ? "rotate-180" : ""}`} size={19} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Walk</span>
            {formatMiles(option.walkToStopMiles)}
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Wait</span>
            {option.waitMinutes} min
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Drop off</span>
            {dropoff}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
          <Step
            icon={Footprints}
            title="Walk to bus stop"
            detail={`${option.originStop.name} - ${formatMiles(option.walkToStopMiles)}`}
            href={buildGoogleWalkingLink(option.origin.coordinate, stopCoordinate(option.originStop))}
          />
          <Step
            icon={Bus}
            title="Ride the bus"
            detail={`${option.route.shortName || option.route.name} toward ${option.destinationStop.name}`}
          />
          <Step icon={Signpost} title="Get off at your stop" detail={option.destinationStop.name} href={buildGoogleSearchLink(option.destinationStop.name)} />
          <Step
            icon={Footprints}
            title="Walk to your destination"
            detail={`${formatMiles(option.walkFromStopMiles)} remaining`}
            href={buildGoogleWalkingLink(stopCoordinate(option.destinationStop), option.destination.coordinate)}
          />
        </div>
      )}
    </article>
  );
}

function Step({
  icon: Icon,
  title,
  detail,
  href
}: {
  icon: typeof Footprints;
  title: string;
  detail: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-black/24 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gsu-blue text-white">
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="truncate text-sm text-slate-400">{detail}</div>
      </div>
      {href && (
        <a className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-sky-300/20 text-slate-200 hover:bg-white/10" href={href} target="_blank">
          <Navigation size={16} />
        </a>
      )}
    </div>
  );
}

export default function PantherNavApp() {
  const [activeTab, setActiveTab] = useState<TabId>("routes");
  const [snapshot, setSnapshot] = useState<TransitSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<LocationChoice | null>(null);
  const [customOrigin, setCustomOrigin] = useState<LocationChoice | null>(null);
  const [customDestination, setCustomDestination] = useState<LocationChoice | null>(null);

  async function loadTransit() {
    try {
      setError(null);
      const response = await fetch("/api/passio", { cache: "no-store" });
      if (!response.ok) throw new Error("Transit data is temporarily unavailable");
      const data = (await response.json()) as TransitSnapshot;
      setSnapshot(data);
      setSelectedStopId((current) => current || data.stops[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load transit data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransit();
    const vehicleTimer = window.setInterval(loadTransit, 10_000);
    return () => window.clearInterval(vehicleTimer);
  }, []);

  const originChoice = useMemo(() => {
    if (origin === "Current location" && currentLocation) return currentLocation;
    if (customOrigin?.label === origin) return customOrigin;
    return resolveChoice(origin, snapshot?.stops ?? []);
  }, [currentLocation, customOrigin, origin, snapshot?.stops]);
  const destinationChoice = useMemo(() => {
    if (customDestination?.label === destination) return customDestination;
    return resolveChoice(destination, snapshot?.stops ?? []);
  }, [customDestination, destination, snapshot?.stops]);
  const rankedRoutes = useMemo(() => findRankedRoutes(originChoice, destinationChoice, snapshot), [originChoice, destinationChoice, snapshot]);
  const selectedStop = snapshot?.stops.find((stop) => stop.id === selectedStopId) ?? snapshot?.stops[0];
  const activeVehicles = useMemo(
    () => [...(snapshot?.vehicles ?? [])].sort((a, b) => a.routeName.localeCompare(b.routeName) || a.name.localeCompare(b.name)),
    [snapshot?.vehicles]
  );

  const arrivals = useMemo(() => {
    if (!snapshot || !selectedStop) return [];

    return snapshot.routes
      .filter((route) => selectedStop && Object.keys(selectedStop.routesAndPositions).some((key) => [route.id, route.myid, route.groupId].includes(key)))
      .map((route) => {
        const vehicles = vehiclesForRoute(snapshot.vehicles, route);
        const closestVehicle = vehicles
          .map((vehicle) => ({
            vehicle,
            miles: milesBetween({ lat: vehicle.latitude, lng: vehicle.longitude }, stopCoordinate(selectedStop))
          }))
          .sort((a, b) => a.miles - b.miles)[0];

        const minutes = closestVehicle ? Math.max(1, Math.ceil(closestVehicle.miles / 0.22)) : 15;

        return {
          route,
          minutes,
          destination: selectedStop.name,
          activeBuses: vehicles.length
        };
      })
      .sort((a, b) => a.minutes - b.minutes);
  }, [selectedStop, snapshot]);

  return (
    <main className="min-h-screen">
      <header className="border-b border-sky-300/15 bg-gsu-blue/95 px-4 py-4 shadow-2xl shadow-black/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gsu-red">
              <Bus size={23} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-white">PantherNav</h1>
              <p className="truncate text-sm text-blue-100">Georgia State campus transit</p>
            </div>
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/20 text-white hover:bg-white/10"
            onClick={loadTransit}
            title="Refresh transit data"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
          </button>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-sky-300/10 bg-black/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                  active ? "bg-gsu-red text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-gsu-red/50 bg-gsu-red/15 p-4 text-sm text-red-100">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {activeTab === "routes" && (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
              <div className="mb-4 flex items-center gap-2">
                <Compass className="text-gsu-red" size={19} />
                <h2 className="text-lg font-black text-white">Find a ride</h2>
              </div>
              <div className="grid gap-4">
                <PlaceInput
                  id="origin"
                  label="Where are you?"
                  value={origin}
                  onChange={setOrigin}
                  onPlaceSelect={setCustomOrigin}
                  placeholder="Search campus"
                  stops={snapshot?.stops ?? []}
                />
                <PlaceInput
                  id="destination"
                  label="Where to?"
                  value={destination}
                  onChange={setDestination}
                  onPlaceSelect={setCustomDestination}
                  placeholder="Search destination"
                  stops={snapshot?.stops ?? []}
                />
                <button
                  className="flex items-center justify-center gap-2 rounded-lg bg-gsu-blue px-4 py-3 text-sm font-black text-white hover:bg-blue-900"
                  onClick={() => {
                    navigator.geolocation?.getCurrentPosition((position) => {
                      setOrigin("Current location");
                      setCurrentLocation({
                        label: "Current location",
                        coordinate: {
                          lat: position.coords.latitude,
                          lng: position.coords.longitude
                        }
                      });
                    });
                  }}
                >
                  <LocateFixed size={17} />
                  Use current location
                </button>
              </div>
            </aside>

            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white">Best routes</h2>
                <span className="text-sm text-slate-400">{loading ? "Loading" : `${rankedRoutes.length} options`}</span>
              </div>
              {rankedRoutes.length ? (
                rankedRoutes.map((option) => <RouteCard key={`${option.route.id}-${option.originStop.id}-${option.destinationStop.id}`} option={option} />)
              ) : (
                <div className="rounded-lg border border-sky-300/15 bg-gsu-panel p-6 text-sm text-slate-300">
                  No route match inside the half-mile walking radius. Try a stop or building closer to the shuttle loop.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "arrivals" && (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="text-gsu-red" size={19} />
                <h2 className="text-lg font-black text-white">Arrivals</h2>
              </div>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Select stop</span>
                <select
                  value={selectedStopId}
                  onChange={(event) => setSelectedStopId(event.target.value)}
                  className="rounded-lg border border-sky-300/15 bg-black/35 px-3 py-3 text-sm text-white outline-none"
                >
                  {(snapshot?.stops ?? []).map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedStop && (
                <a
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gsu-blue px-4 py-3 text-sm font-black text-white hover:bg-blue-900"
                  href={buildGoogleSearchLink(selectedStop.name)}
                  target="_blank"
                >
                  <Navigation size={17} />
                  Directions to stop
                </a>
              )}
            </aside>

            <div className="grid gap-3">
              {arrivals.map((arrival) => (
                <article key={arrival.route.id} className="flex items-center justify-between gap-4 rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-11 w-2 shrink-0 rounded-full" style={{ backgroundColor: arrival.route.color }} />
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-white">{arrival.route.name}</h3>
                      <p className="truncate text-sm text-slate-400">{arrival.destination}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-black text-white">{formatArrival(arrival.minutes)}</div>
                    <div className="text-xs text-slate-400">{arrival.activeBuses} buses live</div>
                  </div>
                </article>
              ))}
              {!arrivals.length && (
                <div className="rounded-lg border border-sky-300/15 bg-gsu-panel p-6 text-sm text-slate-300">
                  No active arrival predictions for this stop yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "map" && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">Live campus map</h2>
                <p className="text-sm text-slate-400">
                  {snapshot?.vehicles.length ?? 0} buses and {snapshot?.stops.length ?? 0} stops
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-sky-300/15 bg-gsu-panel px-3 py-2 text-sm text-slate-300">
                <MapPin size={16} className="text-gsu-red" />
                GSU system 480
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <LiveTransitMap
                snapshot={snapshot}
                onStopSelect={(stop) => {
                  setSelectedStopId(stop.id);
                  setActiveTab("arrivals");
                }}
              />

              <aside className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">Buses running now</h3>
                    <p className="text-sm text-slate-400">
                      {snapshot?.fetchedAt
                        ? `Updated ${new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            second: "2-digit"
                          }).format(new Date(snapshot.fetchedAt))}`
                        : "Waiting for live data"}
                    </p>
                  </div>
                  <span className="rounded-md bg-gsu-red px-2 py-1 text-xs font-black text-white">{activeVehicles.length}</span>
                </div>

                <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
                  {activeVehicles.map((vehicle) => (
                    <article key={vehicle.id} className="rounded-lg border border-white/10 bg-black/24 p-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
                          style={{ backgroundColor: vehicle.color || "#003366" }}
                        >
                          <Bus size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-black text-white">{vehicle.name}</h4>
                              <p className="truncate text-sm text-slate-400">{vehicle.routeName}</p>
                            </div>
                            {vehicle.speed != null && <span className="shrink-0 text-xs text-slate-500">{Math.round(vehicle.speed)} mph</span>}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <div className="rounded-md bg-white/5 p-2">
                              <span className="block text-slate-500">Heading</span>
                              {Math.round(vehicle.calculatedCourse || 0)} deg
                            </div>
                            <div className="rounded-md bg-white/5 p-2">
                              <span className="block text-slate-500">Load</span>
                              {vehicle.paxLoad == null ? "Live" : `${vehicle.paxLoad}%`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}

                  {!activeVehicles.length && (
                    <div className="rounded-lg border border-sky-300/15 bg-black/24 p-4 text-sm text-slate-300">
                      No buses are reporting live positions right now.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}

        {snapshot?.alerts?.length ? (
          <div className="rounded-lg border border-gsu-red/35 bg-gsu-red/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-red-100">
              <AlertTriangle size={17} />
              Transit alerts
            </div>
            <div className="grid gap-2">
              {snapshot.alerts.slice(0, 2).map((alert) => (
                <p key={alert.id} className="text-sm text-slate-300">
                  {alert.name}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
