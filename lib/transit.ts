import distance from "@turf/distance";
import { point } from "@turf/helpers";

export type Coordinate = {
  lat: number;
  lng: number;
};

export type Route = {
  id: string;
  myid: string;
  groupId: string;
  name: string;
  shortName: string;
  color: string;
  serviceTime?: string | null;
  serviceTimeShort?: string | null;
};

export type Stop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  routesAndPositions: Record<string, number[]>;
};

export type Vehicle = {
  id: string;
  name: string;
  type: string;
  calculatedCourse: number;
  routeId: string;
  routeName: string;
  color: string;
  created: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  paxLoad: number | null;
  outOfService: unknown;
  tripId: string | null;
};

export type TransitSnapshot = {
  systemId: number;
  fetchedAt: string;
  routes: Route[];
  stops: Stop[];
  vehicles: Vehicle[];
  alerts: Array<{
    id: string;
    routeId: string | null;
    name: string;
    description: string;
    important: boolean;
  }>;
};

export type LocationChoice = {
  label: string;
  coordinate: Coordinate;
};

export type RouteOption = {
  route: Route;
  origin: LocationChoice;
  destination: LocationChoice;
  originStop: Stop;
  destinationStop: Stop;
  activeBuses: number;
  loadPercent: number | null;
  walkToStopMiles: number;
  walkFromStopMiles: number;
  waitMinutes: number;
  rideMinutes: number;
  totalMinutes: number;
};

export const GSU_CENTER: Coordinate = { lat: 33.7495, lng: -84.3866 };

export function milesBetween(a: Coordinate, b: Coordinate) {
  return distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: "miles" });
}

export function minutesForWalk(miles: number) {
  return Math.max(1, Math.ceil(miles / 0.05));
}

export function minutesForRide(miles: number) {
  return Math.max(3, Math.ceil(miles / 0.23));
}

export function stopCoordinate(stop: Stop): Coordinate {
  return { lat: stop.latitude, lng: stop.longitude };
}

export function routeKeys(route: Route) {
  return [route.id, route.myid, route.groupId].filter(Boolean).map(String);
}

export function stopServesRoute(stop: Stop, route: Route) {
  return routeKeys(route).some((key) => Object.prototype.hasOwnProperty.call(stop.routesAndPositions, key));
}

export function vehiclesForRoute(vehicles: Vehicle[], route: Route) {
  const keys = new Set(routeKeys(route));
  return vehicles.filter((vehicle) => keys.has(String(vehicle.routeId)) || vehicle.routeName === route.name);
}

export function buildGoogleWalkingLink(origin: Coordinate, destination: Coordinate) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking"
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleSearchLink(query: string) {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function findRankedRoutes(
  origin: LocationChoice,
  destination: LocationChoice,
  snapshot: TransitSnapshot | null
) {
  if (!snapshot) return [];

  const nearbyOriginStops = snapshot.stops
    .map((stop) => ({
      stop,
      distanceMiles: milesBetween(origin.coordinate, stopCoordinate(stop))
    }))
    .filter((entry) => entry.distanceMiles <= 0.5)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const nearbyDestinationStops = snapshot.stops
    .map((stop) => ({
      stop,
      distanceMiles: milesBetween(destination.coordinate, stopCoordinate(stop))
    }))
    .filter((entry) => entry.distanceMiles <= 0.5)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const options: RouteOption[] = [];

  snapshot.routes.forEach((route) => {
    const originStop = nearbyOriginStops.find((entry) => stopServesRoute(entry.stop, route));
    const destinationStop = nearbyDestinationStops.find((entry) => stopServesRoute(entry.stop, route));

    if (!originStop || !destinationStop || originStop.stop.id === destinationStop.stop.id) return;

    const routeVehicles = vehiclesForRoute(snapshot.vehicles, route);
    const activeBuses = routeVehicles.length;
    const loadValues = routeVehicles
      .map((vehicle) => vehicle.paxLoad)
      .filter((load): load is number => load != null && Number.isFinite(load));
    const loadPercent = loadValues.length
      ? Math.round(loadValues.reduce((sum, load) => sum + load, 0) / loadValues.length)
      : null;
    const walkToStopMinutes = minutesForWalk(originStop.distanceMiles);
    const walkFromStopMinutes = minutesForWalk(destinationStop.distanceMiles);
    const rideDistance = milesBetween(stopCoordinate(originStop.stop), stopCoordinate(destinationStop.stop));
    const rideMinutes = minutesForRide(rideDistance);
    const waitMinutes = activeBuses > 0 ? Math.max(1, Math.min(12, Math.ceil(18 / activeBuses))) : 16;

    options.push({
      route,
      origin,
      destination,
      originStop: originStop.stop,
      destinationStop: destinationStop.stop,
      activeBuses,
      loadPercent,
      walkToStopMiles: originStop.distanceMiles,
      walkFromStopMiles: destinationStop.distanceMiles,
      waitMinutes,
      rideMinutes,
      totalMinutes: walkToStopMinutes + waitMinutes + rideMinutes + walkFromStopMinutes
    });
  });

  return options.sort((a, b) => a.totalMinutes - b.totalMinutes).slice(0, 6);
}

export function formatMiles(miles: number) {
  return `${miles.toFixed(2)} mi`;
}

export function formatArrival(minutes: number) {
  if (minutes <= 1) return "arriving now";
  return `${minutes} min away`;
}

export function timeAfter(minutes: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(Date.now() + minutes * 60_000));
}
