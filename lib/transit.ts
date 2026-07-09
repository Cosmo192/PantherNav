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
  address?: string;
  coordinate: Coordinate;
};

export type GsuBuilding = {
  name: string;
  address: string;
  code: string;
  coordinate: Coordinate;
};

export const GSU_BUILDINGS: GsuBuilding[] = [
  { name: "Five Points MARTA Station", address: "30 Alabama St SW, Atlanta, GA 30303", code: "FIVE", coordinate: { lat: 33.7538, lng: -84.3916 } },
  { name: "25 Park Place Building", address: "25 Park Place NE, Atlanta, GA 30303", code: "25PP", coordinate: { lat: 33.754, lng: -84.3874 } },
  { name: "55 Park Place", address: "55 Park Place NE, Atlanta, GA 30303", code: "55PP", coordinate: { lat: 33.7551, lng: -84.3875 } },
  { name: "75 Piedmont Building", address: "75 Piedmont Avenue NE, Atlanta, GA 30303", code: "75PIED", coordinate: { lat: 33.7561, lng: -84.3825 } },
  { name: "Aderhold Learning Center", address: "60 Luckie Street NW, Atlanta, GA 30303", code: "ALC", coordinate: { lat: 33.757, lng: -84.3892 } },
  { name: "Alumni Hall", address: "30 Courtland Street SE, Atlanta, GA 30303", code: "AA", coordinate: { lat: 33.7532, lng: -84.3846 } },
  { name: "Art and Humanities Building", address: "10 Peachtree Center Avenue NE, Atlanta, GA 30303", code: "ART", coordinate: { lat: 33.7542, lng: -84.3861 } },
  { name: "Centennial Hall", address: "100 Auburn Avenue NE, Atlanta, GA 30303", code: "CEH", coordinate: { lat: 33.7555, lng: -84.3838 } },
  { name: "Classroom South", address: "62 Decatur Street SE, Atlanta, GA 30303", code: "CLS", coordinate: { lat: 33.7523, lng: -84.3852 } },
  { name: "College of Arts and Sciences", address: "25 Park Place NE, Atlanta, GA 30303", code: "CAS", coordinate: { lat: 33.754, lng: -84.3874 } },
  { name: "College of Education and Human Development", address: "30 Pryor Street SW, Atlanta, GA 30303", code: "COE", coordinate: { lat: 33.7522, lng: -84.3889 } },
  { name: "College of Law", address: "85 Park Place NE, Atlanta, GA 30303", code: "LAW", coordinate: { lat: 33.7561, lng: -84.3867 } },
  { name: "Convocation Center", address: "455 Capitol Avenue SE, Atlanta, GA 30312", code: "CONV", coordinate: { lat: 33.7416, lng: -84.3846 } },
  { name: "Dahlberg Hall", address: "30 Courtland Street SE, Atlanta, GA 30303", code: "DAHL", coordinate: { lat: 33.7536, lng: -84.3847 } },
  { name: "Dunwoody Building", address: "14 Edgewood Avenue NE, Atlanta, GA 30303", code: "DUN", coordinate: { lat: 33.7543, lng: -84.3886 } },
  { name: "Georgia State Sports Arena", address: "125 Decatur Street SE, Atlanta, GA 30303", code: "SA", coordinate: { lat: 33.7512, lng: -84.384 } },
  { name: "Helen M. Aderhold Learning Center", address: "60 Luckie Street NW, Atlanta, GA 30303", code: "ALC", coordinate: { lat: 33.757, lng: -84.3892 } },
  { name: "J. Mack Robinson College of Business", address: "35 Broad Street NW, Atlanta, GA 30303", code: "RCB", coordinate: { lat: 33.7554, lng: -84.3892 } },
  { name: "Langdale Hall", address: "38 Peachtree Center Avenue SE, Atlanta, GA 30303", code: "LANG", coordinate: { lat: 33.7536, lng: -84.386 } },
  { name: "Library North", address: "100 Decatur Street SE, Atlanta, GA 30303", code: "LIBN", coordinate: { lat: 33.7522, lng: -84.3844 } },
  { name: "Library South", address: "100 Decatur Street SE, Atlanta, GA 30303", code: "LIBS", coordinate: { lat: 33.752, lng: -84.3837 } },
  { name: "Lofts", address: "135 Edgewood Avenue SE, Atlanta, GA 30303", code: "LOFT", coordinate: { lat: 33.7541, lng: -84.3834 } },
  { name: "Natural Science Center", address: "50 Decatur Street SE, Atlanta, GA 30303", code: "NSC", coordinate: { lat: 33.7528, lng: -84.3853 } },
  { name: "Noah Langdale Hall", address: "38 Peachtree Center Avenue SE, Atlanta, GA 30303", code: "LANG", coordinate: { lat: 33.7536, lng: -84.386 } },
  { name: "One Park Place", address: "1 Park Place NE, Atlanta, GA 30303", code: "1PP", coordinate: { lat: 33.7534, lng: -84.388 } },
  { name: "Parker H. Petit Science Center", address: "100 Piedmont Avenue SE, Atlanta, GA 30303", code: "PSC", coordinate: { lat: 33.751, lng: -84.3825 } },
  { name: "Patton Hall", address: "160 Edgewood Avenue NE, Atlanta, GA 30303", code: "PAT", coordinate: { lat: 33.7544, lng: -84.3828 } },
  { name: "Piedmont Central", address: "92 Piedmont Avenue NE, Atlanta, GA 30303", code: "PC", coordinate: { lat: 33.7558, lng: -84.3821 } },
  { name: "Piedmont North", address: "175 Piedmont Avenue NE, Atlanta, GA 30303", code: "PN", coordinate: { lat: 33.7582, lng: -84.3825 } },
  { name: "Rialto Center for the Arts", address: "80 Forsyth Street NW, Atlanta, GA 30303", code: "RIALTO", coordinate: { lat: 33.7567, lng: -84.3895 } },
  { name: "Science Annex", address: "58 Edgewood Avenue SE, Atlanta, GA 30303", code: "SAEX", coordinate: { lat: 33.754, lng: -84.386 } },
  { name: "Sparks Hall", address: "33 Gilmer Street SE, Atlanta, GA 30303", code: "SPARKS", coordinate: { lat: 33.7536, lng: -84.3853 } },
  { name: "Student Center East", address: "55 Gilmer Street SE, Atlanta, GA 30303", code: "SCE", coordinate: { lat: 33.7532, lng: -84.3845 } },
  { name: "Student Center West", address: "66 Courtland Street SE, Atlanta, GA 30303", code: "SCW", coordinate: { lat: 33.7527, lng: -84.3842 } },
  { name: "Student Recreation Center", address: "101 Piedmont Avenue SE, Atlanta, GA 30303", code: "SRC", coordinate: { lat: 33.7518, lng: -84.3832 } },
  { name: "SunTrust Building", address: "25 Park Place NE, Atlanta, GA 30303", code: "ST", coordinate: { lat: 33.754, lng: -84.3874 } },
  { name: "University Commons Building A", address: "141 Piedmont Avenue NE, Atlanta, GA 30303", code: "UCA", coordinate: { lat: 33.7571, lng: -84.3825 } },
  { name: "University Commons Building B", address: "141 Piedmont Avenue NE, Atlanta, GA 30303", code: "UCB", coordinate: { lat: 33.757, lng: -84.382 } },
  { name: "University Commons Building C", address: "141 Piedmont Avenue NE, Atlanta, GA 30303", code: "UCC", coordinate: { lat: 33.7566, lng: -84.382 } },
  { name: "University Commons Building D", address: "141 Piedmont Avenue NE, Atlanta, GA 30303", code: "UCD", coordinate: { lat: 33.7565, lng: -84.3826 } },
  { name: "University Lofts", address: "135 Edgewood Avenue SE, Atlanta, GA 30303", code: "LOFT", coordinate: { lat: 33.7541, lng: -84.3834 } },
  { name: "Urban Life Building", address: "140 Decatur Street SE, Atlanta, GA 30303", code: "UL", coordinate: { lat: 33.7509, lng: -84.3835 } }
].sort((a, b) => a.name.localeCompare(b.name));

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
