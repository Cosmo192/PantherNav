import { NextResponse } from "next/server";

const PASSIO_BASE_URL = "https://passiogo.com";
const SYSTEM_ID = process.env.NEXT_PUBLIC_PASSIO_SYSTEM_ID ?? "480";

async function passioPost<T>(path: string, body: Record<string, unknown> | null) {
  const response = await fetch(`${PASSIO_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "PantherNav/0.1"
    },
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`PassioGO responded with ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeRoutes(payload: any) {
  const routes = Array.isArray(payload?.all) ? payload.all : Array.isArray(payload) ? payload : [];

  return routes.map((route: any) => ({
    id: String(route.id ?? route.myid ?? route.groupId),
    myid: String(route.myid ?? route.id ?? ""),
    groupId: String(route.groupId ?? ""),
    name: route.name ?? route.nameOrig ?? "Campus Route",
    shortName: route.shortName ?? route.name ?? "GSU",
    color: route.groupColor ?? "#003366",
    serviceTime: route.serviceTime ?? null,
    serviceTimeShort: route.serviceTimeShort ?? null
  }));
}

function normalizeStops(payload: any) {
  const stopsById = payload?.stops && !Array.isArray(payload.stops) ? payload.stops : {};
  const routeStopOrder = new Map<string, string[]>();

  if (payload?.routes && !Array.isArray(payload.routes)) {
    Object.entries<any[]>(payload.routes).forEach(([routeId, route]) => {
      const stopIds = route
        .slice(2)
        .filter(Boolean)
        .map((entry: any) => String(Array.isArray(entry) ? entry[1] : entry))
        .filter((id: string) => id && id !== "0");
      routeStopOrder.set(String(routeId), stopIds);
    });
  }

  return Object.entries<any>(stopsById).map(([id, stop]) => {
    const routesAndPositions: Record<string, number[]> = {};
    routeStopOrder.forEach((stopIds, routeId) => {
      const positions = stopIds.reduce<number[]>((found, stopId, index) => {
        if (stopId === String(stop.id ?? id)) found.push(index);
        return found;
      }, []);
      if (positions.length) routesAndPositions[routeId] = positions;
    });

    return {
      id: String(stop.id ?? id),
      name: stop.name ?? "Campus Stop",
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      radius: Number(stop.radius ?? 40),
      routesAndPositions
    };
  });
}

function normalizeVehicles(payload: any) {
  const buses = payload?.buses && !Array.isArray(payload.buses) ? payload.buses : {};

  return Object.entries<any>(buses)
    .filter(([id]) => id !== "-1")
    .map(([id, entries]) => {
      const vehicle = Array.isArray(entries) ? entries[0] : entries;
      return {
        id: String(vehicle?.busId ?? id),
        name: vehicle?.busName ?? `Bus ${id}`,
        type: vehicle?.busType ?? "bus",
        calculatedCourse: Number(vehicle?.calculatedCourse ?? 0),
        routeId: String(vehicle?.routeId ?? ""),
        routeName: vehicle?.route ?? "Campus Route",
        color: vehicle?.color ?? "#003366",
        created: vehicle?.created ?? null,
        latitude: Number(vehicle?.latitude),
        longitude: Number(vehicle?.longitude),
        speed: vehicle?.speed == null ? null : Number(vehicle.speed),
        paxLoad: vehicle?.paxLoad100 == null ? null : Number(vehicle.paxLoad100),
        outOfService: vehicle?.outOfService ?? null,
        tripId: vehicle?.tripId ?? null
      };
    })
    .filter((vehicle) => Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude));
}

function normalizeAlerts(payload: any) {
  const messages = Array.isArray(payload?.msgs) ? payload.msgs : [];

  return messages.map((message: any) => ({
    id: String(message.id),
    routeId: message.routeId ? String(message.routeId) : null,
    name: message.name ?? "Transit alert",
    description: message.gtfsAlertDescriptionText ?? message.html ?? "",
    important: message.important === "1" || message.important === 1 || message.important === true
  }));
}

export async function GET() {
  try {
    const [routesPayload, stopsPayload, vehiclesPayload, alertsPayload] = await Promise.all([
      passioPost<any>("/mapGetData.php?getRoutes=1", {
        systemSelected0: SYSTEM_ID,
        amount: 1
      }),
      passioPost<any>("/mapGetData.php?getStops=2", {
        s0: SYSTEM_ID,
        sA: 1
      }),
      passioPost<any>("/mapGetData.php?getBuses=2", {
        s0: SYSTEM_ID,
        sA: 1
      }),
      passioPost<any>("/goServices.php?getAlertMessages=1", {
        systemSelected0: SYSTEM_ID,
        amount: 1,
        routesAmount: 0
      })
    ]);

    return NextResponse.json({
      systemId: Number(SYSTEM_ID),
      fetchedAt: new Date().toISOString(),
      routes: normalizeRoutes(routesPayload),
      stops: normalizeStops(stopsPayload),
      vehicles: normalizeVehicles(vehiclesPayload),
      alerts: normalizeAlerts(alertsPayload)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load PassioGO data"
      },
      { status: 502 }
    );
  }
}
