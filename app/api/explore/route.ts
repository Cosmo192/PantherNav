import { NextResponse } from "next/server";

const GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

const categories: Record<string, { type?: string; keyword?: string }> = {
  food: { type: "restaurant" },
  parks: { type: "park" },
  museums: { type: "museum" },
  entertainment: { keyword: "entertainment" },
  shopping: { type: "shopping_mall" },
  landmarks: { type: "tourist_attraction", keyword: "landmark" },
  cafes: { type: "cafe" },
  nightlife: { type: "night_club", keyword: "bar" }
};

function googleMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

function photoUrl(reference: string) {
  const params = new URLSearchParams({ photoReference: reference });
  return `/api/explore?${params.toString()}`;
}

function normalizePlace(place: any) {
  const location = place.geometry?.location ?? {};

  return {
    id: String(place.place_id ?? place.name),
    name: String(place.name ?? "Unnamed place"),
    rating: typeof place.rating === "number" ? place.rating : null,
    reviews: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
    address: place.formatted_address || place.vicinity || "",
    lat: typeof location.lat === "number" ? location.lat : null,
    lng: typeof location.lng === "number" ? location.lng : null,
    types: Array.isArray(place.types) ? place.types : [],
    photoUrl: place.photos?.[0]?.photo_reference ? photoUrl(place.photos[0].photo_reference) : null,
    phone: place.formatted_phone_number || null,
    website: place.website || null,
    mapsUrl: place.url || null,
    openNow: typeof place.opening_hours?.open_now === "boolean" ? place.opening_hours.open_now : null,
    weekdayText: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : []
  };
}

export async function GET(request: Request) {
  const key = googleMapsKey();
  if (!key) {
    return NextResponse.json({ error: "Missing Google Maps API key" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const photoReference = searchParams.get("photoReference");
  const placeId = searchParams.get("placeId");

  if (photoReference) {
    const params = new URLSearchParams({
      maxwidth: "800",
      photo_reference: photoReference,
      key
    });

    return NextResponse.redirect(`${GOOGLE_PLACES_BASE}/photo?${params.toString()}`);
  }

  if (placeId) {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "place_id,name,rating,user_ratings_total,formatted_address,vicinity,geometry,types,photos,formatted_phone_number,website,url,opening_hours",
      key
    });

    const response = await fetch(`${GOOGLE_PLACES_BASE}/details/json?${params.toString()}`, {
      next: { revalidate: 300 }
    });
    const data = await response.json();

    if (!response.ok || data.status !== "OK") {
      return NextResponse.json({ error: data.error_message || "Unable to load place details" }, { status: 502 });
    }

    return NextResponse.json({ place: normalizePlace(data.result) });
  }

  const category = searchParams.get("category") || "food";
  const categoryConfig = categories[category] ?? categories.food;
  const lat = searchParams.get("lat") || "33.7495";
  const lng = searchParams.get("lng") || "-84.3866";
  const radius = searchParams.get("radius") || "15000";

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius,
    key
  });

  if (categoryConfig.type) params.set("type", categoryConfig.type);
  if (categoryConfig.keyword) params.set("keyword", categoryConfig.keyword);

  const response = await fetch(`${GOOGLE_PLACES_BASE}/nearbysearch/json?${params.toString()}`, {
    next: { revalidate: 300 }
  });
  const data = await response.json();

  if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
    return NextResponse.json({ error: data.error_message || "Unable to load nearby places" }, { status: 502 });
  }

  const places = (data.results ?? [])
    .map(normalizePlace)
    .filter((place: ReturnType<typeof normalizePlace>) => place.lat != null && place.lng != null)
    .slice(0, 12);

  return NextResponse.json({ places });
}
