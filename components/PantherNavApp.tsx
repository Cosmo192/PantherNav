"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Bus,
  ChevronDown,
  Clock3,
  Compass,
  Footprints,
  MapPin,
  Moon,
  Navigation,
  RefreshCw,
  Search,
  Signpost,
  Sun,
} from "lucide-react";
import ExploreTab, { ExplorePlace } from "@/components/ExploreTab";
import { gsuBounds, loadGoogleMaps } from "@/lib/googleMaps";
import {
  buildGoogleSearchLink,
  buildGoogleWalkingLink,
  findRankedRoutes,
  formatArrival,
  formatMiles,
  GSU_BUILDINGS,
  GSU_CENTER,
  GsuBuilding,
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

type TabId = "explore" | "navigate";

const tabs: Array<{ id: TabId; label: string; icon: typeof Compass }> = [
  { id: "explore", label: "Explore", icon: Compass },
  { id: "navigate", label: "Navigate", icon: Navigation }
];

function useDeviceType() {
  const [deviceType, setDeviceType] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    function updateDeviceType() {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    }

    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);
    return () => window.removeEventListener("resize", updateDeviceType);
  }, []);

  return {
    deviceType,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop"
  };
}

function hidePlacesContainers() {
  document.querySelectorAll<HTMLElement>(".pac-container").forEach((container) => {
    container.style.display = "none";
  });
}

function scopePlacesContainers(activeInputId: string) {
  const containers = Array.from(document.querySelectorAll<HTMLElement>(".pac-container"));
  const activeContainer = containers[containers.length - 1];

  containers.forEach((container) => {
    if (container === activeContainer) {
      container.dataset.panthernavInput = activeInputId;
      container.style.display = "";
    } else {
      container.style.display = "none";
    }
  });
}

function resolveChoice(value: string, stops: Stop[]): LocationChoice {
  const normalized = value.trim().toLowerCase();
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
  placeholder
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (choice: LocationChoice) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLLabelElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const suppressPlacesRef = useRef(false);
  const dropdownSelectionRef = useRef(false);
  const dropdownSelectionTimerRef = useRef<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState("");
  const filteredBuildings = useMemo(() => {
    const query = dropdownQuery.trim().toLowerCase();
    if (!query) return GSU_BUILDINGS;

    return GSU_BUILDINGS.filter((building) => {
      return [building.name, building.address, building.code].some((field) => field.toLowerCase().includes(query));
    });
  }, [dropdownQuery]);

  function hideGooglePlacesPopup(blurInput = true) {
    suppressPlacesRef.current = true;
    document.body.classList.add("panthernav-hide-places");
    if (blurInput) inputRef.current?.blur();

    window.setTimeout(() => {
      hidePlacesContainers();
    }, 0);
  }

  function allowGooglePlacesPopup() {
    if (dropdownSelectionRef.current) {
      hideGooglePlacesPopup(false);
      return;
    }

    suppressPlacesRef.current = false;
    document.body.classList.remove("panthernav-hide-places");

    window.setTimeout(() => scopePlacesContainers(id), 0);
  }

  function handleInputChange(nextValue: string) {
    if (dropdownOpen) {
      setDropdownQuery(nextValue);
      hideGooglePlacesPopup(false);
    } else {
      allowGooglePlacesPopup();
    }

    onChange(nextValue);
  }

  function toggleDropdown() {
    setDropdownOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setDropdownQuery("");
        hideGooglePlacesPopup();
      }

      return nextOpen;
    });
  }

  function selectBuilding(building: GsuBuilding) {
    const choice = {
      label: building.name,
      address: building.address,
      coordinate: building.coordinate
    };

    dropdownSelectionRef.current = true;
    if (dropdownSelectionTimerRef.current) {
      window.clearTimeout(dropdownSelectionTimerRef.current);
    }

    onChange(building.name);
    onPlaceSelect?.(choice);
    setDropdownOpen(false);
    setDropdownQuery("");
    autocompleteRef.current?.set?.("place", null);
    hideGooglePlacesPopup();
    window.setTimeout(() => hideGooglePlacesPopup(false), 120);

    dropdownSelectionTimerRef.current = window.setTimeout(() => {
      dropdownSelectionRef.current = false;
      dropdownSelectionTimerRef.current = null;
    }, 250);

    loadGoogleMaps().then((ready) => {
      const google = (window as any).google;
      if (!ready || !google?.maps?.Geocoder) return;

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: building.address }, (results: any[], status: string) => {
        const location = results?.[0]?.geometry?.location;
        if (status !== "OK" || !location) return;

        onPlaceSelect?.({
          ...choice,
          coordinate: {
            lat: location.lat(),
            lng: location.lng()
          }
        });
      });
    });
  }

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
      autocompleteRef.current = autocomplete;

      listener = autocomplete.addListener("place_changed", () => {
        allowGooglePlacesPopup();
        const place = autocomplete.getPlace();
        const location = place?.geometry?.location;
        if (!location) return;
        const label = place.name || place.formatted_address || inputRef.current?.value || "Selected location";
        onChange(label);
        setDropdownOpen(false);
        setDropdownQuery("");
        hideGooglePlacesPopup();
        onPlaceSelect?.({
          label,
          address: place.formatted_address,
          coordinate: {
            lat: location.lat(),
            lng: location.lng()
          }
        });
      });
    });

    return () => {
      listener?.remove?.();
      autocompleteRef.current = null;
      if (dropdownSelectionTimerRef.current) {
        window.clearTimeout(dropdownSelectionTimerRef.current);
      }
    };
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
        setDropdownQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      hideGooglePlacesPopup();
    };
  }, []);

  return (
    <label ref={wrapperRef} className="relative grid gap-2">
      <span className="location-input-label text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <div className="location-input-shell flex items-center gap-2 rounded-lg border border-sky-300/15 bg-black/35 px-3 py-2.5 focus-within:border-sky-300/45">
        <Search size={18} className="location-search-icon shrink-0 text-slate-400" />
        <input
          id={id}
          ref={inputRef}
          value={value}
          onFocus={() => {
            if (!dropdownOpen) allowGooglePlacesPopup();
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (document.activeElement !== inputRef.current) hideGooglePlacesPopup(false);
            }, 150);
          }}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDropdownOpen(false);
              setDropdownQuery("");
              hideGooglePlacesPopup();
            }
          }}
          placeholder={placeholder}
          className="location-input min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          className="location-dropdown-button grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={toggleDropdown}
          aria-label={`${dropdownOpen ? "Close" : "Open"} ${label} building list`}
          aria-expanded={dropdownOpen}
        >
          <ChevronDown className={`transition ${dropdownOpen ? "rotate-180" : ""}`} size={18} />
        </button>
      </div>
      {dropdownOpen && (
        <div className="location-dropdown-list absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-lg border border-sky-300/20 bg-gsu-panel p-1 shadow-2xl shadow-black/40">
          {filteredBuildings.length ? (
            filteredBuildings.map((building) => (
              <button
                key={`${id}-${building.code}-${building.name}`}
                type="button"
                className="location-building-item grid w-full gap-0.5 rounded-md px-3 py-2.5 text-left transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                onClick={() => selectBuilding(building)}
              >
                <span className="text-sm font-bold text-white">{building.name}</span>
                <span className="truncate text-xs text-slate-400">{building.address}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400">No matching GSU buildings</div>
          )}
        </div>
      )}
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

        <div className="grid grid-cols-4 gap-1.5 text-[11px] text-slate-300 sm:gap-2 sm:text-xs">
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Walk</span>
            {formatMiles(option.walkToStopMiles + option.walkFromStopMiles)}
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Wait</span>
            {option.waitMinutes} min
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Drop off</span>
            {dropoff}
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <span className="block text-slate-500">Load</span>
            {option.loadPercent == null ? "--" : `${option.loadPercent}%`}
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
        <a className="map-link-button grid h-9 w-9 shrink-0 place-items-center rounded-md border border-sky-300/20 text-slate-200 hover:bg-white/10" href={href} target="_blank">
          <Navigation size={16} />
        </a>
      )}
    </div>
  );
}

export default function PantherNavApp() {
  const { deviceType, isMobile, isDesktop } = useDeviceType();
  const [activeTab, setActiveTab] = useState<TabId>("explore");
  const [snapshot, setSnapshot] = useState<TransitSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
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

  async function handleManualRefresh() {
    if (refreshCooldown > 0 || loading) return;

    setRefreshCooldown(10);
    await loadTransit();
  }

  function handleExploreDirections(place: ExplorePlace, destinationChoice: LocationChoice) {
    setDestination(place.name);
    setCustomDestination(destinationChoice);
    setActiveTab("navigate");
  }

  useEffect(() => {
    loadTransit();
    const vehicleTimer = window.setInterval(loadTransit, 10_000);
    return () => window.clearInterval(vehicleTimer);
  }, []);

  useEffect(() => {
    if (refreshCooldown <= 0) return;

    const cooldownTimer = window.setTimeout(() => {
      setRefreshCooldown((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearTimeout(cooldownTimer);
  }, [refreshCooldown]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("panthernav-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("panthernav-theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const placesActive = activeTab === "navigate" || activeTab === "explore";
    document.body.classList.toggle("panthernav-places-active", placesActive);

    if (!placesActive) {
      document.body.classList.add("panthernav-hide-places");
      hidePlacesContainers();
    }

    return () => {
      document.body.classList.remove("panthernav-places-active");
      document.body.classList.remove("panthernav-hide-places");
    };
  }, [activeTab]);

  const originChoice = useMemo(() => {
    if (customOrigin?.label === origin) return customOrigin;
    return resolveChoice(origin, snapshot?.stops ?? []);
  }, [customOrigin, origin, snapshot?.stops]);
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

  const tabButtons = (
    <>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
              active ? "bg-gsu-blue text-white shadow-sm" : "bg-white/60 text-slate-600 hover:bg-white"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon size={17} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <main className={`panthernav-${theme} device-${deviceType} min-h-screen pb-20 md:pb-0`}>
      <header className="border-b border-sky-300/10 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gsu-red text-white shadow-sm">
              <Bus size={23} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-slate-900">PantherNav</h1>
              <p className="truncate text-sm text-slate-500">{isMobile ? "Explore. Navigate." : "Explore Atlanta. Navigate GSU."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="theme-toggle"
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="refresh-button"
              onClick={handleManualRefresh}
              disabled={refreshCooldown > 0 || loading}
              title={refreshCooldown > 0 ? `Refresh available in ${refreshCooldown}s` : "Refresh transit data"}
            >
              {refreshCooldown > 0 ? (
                <span className="text-xs font-black">{refreshCooldown}</span>
              ) : (
                <RefreshCw className={loading ? "refresh-icon animate-spin" : "refresh-icon"} size={18} />
              )}
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 hidden border-b border-sky-300/10 bg-white/70 px-4 py-3 backdrop-blur md:block">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          {tabButtons}
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-gsu-red/50 bg-gsu-red/15 p-4 text-sm text-red-100">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {activeTab === "explore" && <ExploreTab onGetDirections={handleExploreDirections} />}

        {activeTab === "navigate" && (
          <div className={`grid gap-4 ${isDesktop ? "xl:grid-cols-[minmax(0,1fr)_390px]" : ""}`}>
            <div className="grid gap-4">
              <div className="rounded-lg border border-sky-300/15 bg-gsu-panel/95 p-4 shadow-glow backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white">Navigate</h2>
                    <p className="text-sm text-slate-400">Search, watch live buses, and compare routes in one place.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                  <PlaceInput
                    id="origin"
                    label="From"
                    value={origin}
                    onChange={setOrigin}
                    onPlaceSelect={setCustomOrigin}
                    placeholder="Search campus or choose a building"
                  />
                  <button
                    className="location-swap justify-self-center sm:self-end"
                    onClick={() => {
                      setOrigin(destination);
                      setDestination(origin);
                      setCustomOrigin(customDestination);
                      setCustomDestination(customOrigin);
                    }}
                    title="Swap origin and destination"
                    aria-label="Swap from and to locations"
                  >
                    <ArrowUpDown size={16} />
                  </button>
                  <PlaceInput
                    id="destination"
                    label="To"
                    value={destination}
                    onChange={setDestination}
                    onPlaceSelect={setCustomDestination}
                    placeholder="Search destination"
                  />
                </div>
              </div>

              <div className="live-map-shell flex h-[72vh] min-h-[520px] flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-gsu-panel shadow-glow">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-300/10 px-4 py-3">
                  <div>
                    <h3 className="text-base font-black text-white">Live Map</h3>
                    <p className="text-sm text-slate-400">
                      {snapshot?.vehicles.length ?? 0} buses and {snapshot?.stops.length ?? 0} stops
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">
                    <MapPin size={16} className="text-gsu-red" />
                    GSU system 480
                  </div>
                </div>
                <div className="live-map-frame min-h-0 flex-1">
                  <LiveTransitMap
                    snapshot={snapshot}
                    theme={theme}
                    onStopSelect={(stop) => {
                      setSelectedStopId(stop.id);
                    }}
                  />
                </div>
              </div>
            </div>

            <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
              <section className="rounded-t-2xl border border-sky-300/15 bg-gsu-panel p-4 shadow-glow sm:rounded-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">Best Routes</h3>
                    <p className="text-sm text-slate-400">{loading ? "Loading transit" : `${rankedRoutes.length} options`}</p>
                  </div>
                  <button
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-sky-300/15 text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleManualRefresh}
                    disabled={refreshCooldown > 0 || loading}
                    title={refreshCooldown > 0 ? `Refresh available in ${refreshCooldown}s` : "Refresh transit data"}
                  >
                    {refreshCooldown > 0 ? <span className="text-xs font-black">{refreshCooldown}</span> : <RefreshCw className={loading ? "animate-spin" : ""} size={18} />}
                  </button>
                </div>
                <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1">
                  {rankedRoutes.length ? (
                    rankedRoutes.map((option) => <RouteCard key={`${option.route.id}-${option.originStop.id}-${option.destinationStop.id}`} option={option} />)
                  ) : (
                    <div className="rounded-lg border border-sky-300/15 bg-black/24 p-4 text-sm text-slate-300">
                      No route match inside the half-mile walking radius. Try a stop or building closer to the shuttle loop.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="text-gsu-red" size={18} />
                  <h3 className="text-base font-black text-white">Arrivals</h3>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Stop</span>
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
                <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">
                  {arrivals.slice(0, 5).map((arrival) => (
                    <article key={arrival.route.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/24 p-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-black text-white">{arrival.route.name}</h4>
                        <p className="truncate text-xs text-slate-400">{arrival.activeBuses} buses live</p>
                      </div>
                      <div className="shrink-0 text-right text-sm font-black text-white">{formatArrival(arrival.minutes)}</div>
                    </article>
                  ))}
                  {!arrivals.length && <div className="rounded-lg bg-black/24 p-3 text-sm text-slate-300">No active arrival predictions for this stop yet.</div>}
                </div>
                {selectedStop && (
                  <a
                    className="primary-action-button mt-3 flex items-center justify-center gap-2 rounded-lg bg-gsu-blue px-4 py-3 text-sm font-black text-white hover:bg-blue-900"
                    href={buildGoogleSearchLink(selectedStop.name)}
                    target="_blank"
                  >
                    <Navigation size={17} />
                    Directions to stop
                  </a>
                )}
              </section>

              <section className="rounded-lg border border-sky-300/15 bg-gsu-panel p-4 shadow-glow">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">Buses Running Now</h3>
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
                <div className="grid max-h-64 gap-3 overflow-y-auto pr-1">
                  {activeVehicles.map((vehicle) => (
                    <article key={vehicle.id} className="rounded-lg border border-white/10 bg-black/24 p-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: vehicle.color || "#003366" }}>
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

                  {!activeVehicles.length && <div className="rounded-lg border border-sky-300/15 bg-black/24 p-4 text-sm text-slate-300">No buses are reporting live positions right now.</div>}
                </div>
              </section>

              {snapshot?.alerts?.length ? (
                <section className="rounded-lg border border-gsu-red/35 bg-gsu-red/10 p-4">
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
                </section>
              ) : null}
            </aside>
          </div>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-300/15 bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">{tabButtons}</div>
      </nav>
    </main>
  );
}
