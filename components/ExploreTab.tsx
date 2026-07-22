"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coffee,
  ExternalLink,
  Globe,
  Landmark,
  Loader2,
  MapPin,
  Music,
  Palette,
  Phone,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Trees,
  Utensils,
  X
} from "lucide-react";
import { formatMiles, GSU_CENTER, LocationChoice, milesBetween } from "@/lib/transit";

const categories = [
  { id: "food", label: "Food", icon: Utensils },
  { id: "parks", label: "Parks", icon: Trees },
  { id: "museums", label: "Museums", icon: Palette },
  { id: "entertainment", label: "Entertainment", icon: Sparkles },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "landmarks", label: "Landmarks", icon: Landmark },
  { id: "cafes", label: "Cafes", icon: Coffee },
  { id: "nightlife", label: "Nightlife", icon: Music }
] as const;

type CategoryId = (typeof categories)[number]["id"];

export type ExplorePlace = {
  id: string;
  name: string;
  rating: number | null;
  reviews: number | null;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  photoUrl: string | null;
  phone?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  openNow?: boolean | null;
  weekdayText?: string[];
};

type CacheEntry = {
  fetchedAt: number;
  places: ExplorePlace[];
};

function placeTypeLabel(types: string[]) {
  const firstType = types.find((type) => !["point_of_interest", "establishment"].includes(type));
  if (!firstType) return "Place";

  return firstType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function placeDistance(place: ExplorePlace) {
  return milesBetween(GSU_CENTER, { lat: place.lat, lng: place.lng });
}

function ratingLabel(place: ExplorePlace) {
  if (place.rating == null) return "No rating yet";
  return `${place.rating.toFixed(1)}${place.reviews ? ` (${place.reviews.toLocaleString()} reviews)` : ""}`;
}

function toLocationChoice(place: ExplorePlace): LocationChoice {
  return {
    label: place.name,
    address: place.address,
    coordinate: { lat: place.lat, lng: place.lng }
  };
}

export default function ExploreTab({ onGetDirections }: { onGetDirections: (place: ExplorePlace, destination: LocationChoice) => void }) {
  const cacheRef = useRef<Record<string, CacheEntry>>({});
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("food");
  const [places, setPlaces] = useState<ExplorePlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ExplorePlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const category = categories.find((item) => item.id === selectedCategory) ?? categories[0];

  async function loadPlaces(categoryId: CategoryId, force = false) {
    const cached = cacheRef.current[categoryId];
    if (!force && cached && Date.now() - cached.fetchedAt < 5 * 60_000) {
      setPlaces(cached.places);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        category: categoryId,
        lat: String(GSU_CENTER.lat),
        lng: String(GSU_CENTER.lng),
        radius: "15000"
      });
      const response = await fetch(`/api/explore?${params.toString()}`);
      if (!response.ok) throw new Error("Something went wrong loading places. Try again later.");
      const data = (await response.json()) as { places?: ExplorePlace[]; error?: string };
      if (data.error) throw new Error(data.error);

      const nextPlaces = data.places ?? [];
      cacheRef.current[categoryId] = { fetchedAt: Date.now(), places: nextPlaces };
      setPlaces(nextPlaces);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Check your connection and try again.");
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  async function openPlace(place: ExplorePlace) {
    setSelectedPlace(place);

    try {
      setDetailsLoading(true);
      const params = new URLSearchParams({ placeId: place.id });
      const response = await fetch(`/api/explore?${params.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as { place?: ExplorePlace };
      if (data.place) setSelectedPlace({ ...place, ...data.place });
    } finally {
      setDetailsLoading(false);
    }
  }

  function handleDirections(place: ExplorePlace) {
    setSelectedPlace(null);
    onGetDirections(place, toLocationChoice(place));
  }

  useEffect(() => {
    loadPlaces(selectedCategory);
  }, [selectedCategory]);

  const sortedPlaces = useMemo(() => {
    return [...places].sort((a, b) => placeDistance(a) - placeDistance(b));
  }, [places]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Explore Atlanta</h2>
          <p className="text-sm text-slate-400">Find nearby places, then send one straight to Route Finder.</p>
        </div>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-sky-300/15 bg-gsu-panel text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => loadPlaces(selectedCategory, true)}
          disabled={loading}
          aria-label="Refresh places"
          title="Refresh places"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => {
          const Icon = item.icon;
          const active = selectedCategory === item.id;

          return (
            <button
              key={item.id}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                active ? "border-gsu-red bg-gsu-red text-white" : "border-sky-300/15 bg-gsu-panel text-slate-300 hover:bg-white/10"
              }`}
              onClick={() => setSelectedCategory(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="grid min-h-64 place-items-center rounded-lg border border-sky-300/15 bg-gsu-panel p-6 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-gsu-red" size={18} />
            Finding nearby {category.label.toLowerCase()}...
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="grid gap-3 rounded-lg border border-gsu-red/50 bg-gsu-red/15 p-5 text-sm text-red-100">
          <span>{error}</span>
          <button className="w-fit rounded-lg bg-gsu-red px-3 py-2 text-xs font-black text-white" onClick={() => loadPlaces(selectedCategory, true)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !sortedPlaces.length && (
        <div className="rounded-lg border border-sky-300/15 bg-gsu-panel p-6 text-sm text-slate-300">
          No places found in {category.label.toLowerCase()}. Try a different category.
        </div>
      )}

      {!loading && !error && sortedPlaces.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} onOpen={openPlace} onGetDirections={handleDirections} />
          ))}
        </div>
      )}

      {selectedPlace && (
        <PlaceDetailsModal
          place={selectedPlace}
          loading={detailsLoading}
          onClose={() => setSelectedPlace(null)}
          onGetDirections={() => handleDirections(selectedPlace)}
        />
      )}
    </div>
  );
}

function PlaceCard({
  place,
  onOpen,
  onGetDirections
}: {
  place: ExplorePlace;
  onOpen: (place: ExplorePlace) => void;
  onGetDirections: (place: ExplorePlace) => void;
}) {
  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-lg border border-sky-300/15 bg-gsu-panel shadow-glow transition hover:-translate-y-0.5 hover:border-gsu-red/45"
      onClick={() => onOpen(place)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(place);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="grid w-full text-left">
        <div className="relative aspect-[16/10] overflow-hidden bg-black/35">
          {place.photoUrl ? (
            <img
              src={place.photoUrl}
              alt={place.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center bg-gsu-blue/25 text-slate-300">
              <MapPin size={28} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
            <div className="flex items-center gap-1 text-sm font-bold text-white">
              <Star className="fill-gsu-red text-gsu-red" size={15} />
              {ratingLabel(place)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4">
          <div>
            <h3 className="line-clamp-2 text-base font-black text-white">{place.name}</h3>
            <span className="mt-2 inline-flex rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-slate-300">{placeTypeLabel(place.types)}</span>
          </div>
          <p className="line-clamp-2 min-h-10 text-sm text-slate-400">{place.address || "Address unavailable"}</p>
          <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
            <span>{formatMiles(placeDistance(place))} from GSU</span>
            <button
              className="flex shrink-0 items-center gap-1 rounded-md bg-gsu-red px-2.5 py-2 text-xs font-black text-white"
              onClick={(event) => {
                event.stopPropagation();
                onGetDirections(place);
              }}
            >
              Directions
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PlaceDetailsModal({
  place,
  loading,
  onClose,
  onGetDirections
}: {
  place: ExplorePlace;
  loading: boolean;
  onClose: () => void;
  onGetDirections: () => void;
}) {
  const touchStartYRef = useRef<number | null>(null);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartYRef.current = event.targetTouches[0]?.clientY ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartYRef.current == null) return;

    const touchEndY = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
    if (touchEndY - touchStartYRef.current > 50) {
      onClose();
    }

    touchStartYRef.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-sky-300/15 bg-gsu-panel shadow-2xl shadow-black/50 sm:max-h-[84vh] sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-sky-300/15 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gsu-red/35 text-gsu-red transition hover:bg-gsu-red/10 active:scale-95"
            onClick={onClose}
            aria-label="Close place details"
            title="Close"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black text-white">{place.name}</h3>
            <p className="truncate text-sm text-slate-400">{place.address || "Address unavailable"}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 [-webkit-overflow-scrolling:touch] sm:p-5">
          <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-lg bg-black/35">
            {place.photoUrl ? (
              <img src={place.photoUrl} alt={place.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-gsu-blue/25 text-slate-300">
                <MapPin size={34} />
              </div>
            )}
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/70 px-3 py-2 text-sm font-bold text-white backdrop-blur">
              <Star className="fill-gsu-red text-gsu-red" size={14} />
              {ratingLabel(place)}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-black text-white">{place.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{place.address || "Address unavailable"}</p>
              </div>
              <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-slate-300">{placeTypeLabel(place.types)}</span>
            </div>

            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-md bg-white/5 p-3">
                <span className="block text-xs text-slate-500">Rating</span>
                {ratingLabel(place)}
              </div>
              <div className="rounded-md bg-white/5 p-3">
                <span className="block text-xs text-slate-500">Distance</span>
                {formatMiles(placeDistance(place))} from GSU
              </div>
              <div className="rounded-md bg-white/5 p-3">
                <span className="block text-xs text-slate-500">Hours</span>
                {place.openNow == null ? "Not listed" : place.openNow ? "Open now" : "Closed now"}
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="animate-spin" size={16} />
                Loading details...
              </div>
            )}

            {(place.phone || place.website || place.mapsUrl) && (
              <div className="flex flex-wrap gap-2">
                {place.phone && (
                  <a className="flex min-h-11 items-center gap-2 rounded-lg border border-sky-300/15 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10" href={`tel:${place.phone}`}>
                    <Phone size={15} />
                    Call
                  </a>
                )}
                {place.website && (
                  <a className="flex min-h-11 items-center gap-2 rounded-lg border border-sky-300/15 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10" href={place.website} target="_blank">
                    <Globe size={15} />
                    Website
                  </a>
                )}
                {place.mapsUrl && (
                  <a className="flex min-h-11 items-center gap-2 rounded-lg border border-sky-300/15 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10" href={place.mapsUrl} target="_blank">
                    <MapPin size={15} />
                    Map
                  </a>
                )}
              </div>
            )}

            {place.weekdayText && place.weekdayText.length > 0 && (
              <div className="rounded-lg bg-black/24 p-3 text-sm text-slate-300">
                {place.weekdayText.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid shrink-0 gap-2 border-t border-sky-300/15 bg-black/24 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
          <button className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gsu-red px-4 py-3 text-sm font-black text-white hover:bg-red-700 active:scale-[0.99]" onClick={onGetDirections}>
            Get Directions
            <ExternalLink size={16} />
          </button>
          <button className="flex min-h-11 items-center justify-center rounded-lg border border-sky-300/25 px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/10 active:scale-[0.99]" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 block -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/60 sm:hidden">
          Swipe down to close
        </div>
      </div>
    </div>
  );
}
