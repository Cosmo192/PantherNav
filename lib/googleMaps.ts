import { GSU_CENTER } from "@/lib/transit";

declare global {
  interface Window {
    google?: any;
    pantherNavGoogleMapsPromise?: Promise<boolean>;
  }
}

export function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || typeof window === "undefined") return Promise.resolve(false);

  if (window.google?.maps) return Promise.resolve(true);
  if (window.pantherNavGoogleMapsPromise) return window.pantherNavGoogleMapsPromise;

  window.pantherNavGoogleMapsPromise = new Promise<boolean>((resolve) => {
    const current = document.querySelector<HTMLScriptElement>("script[data-panthernav-google]");
    if (current) {
      current.addEventListener("load", () => resolve(true), { once: true });
      current.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry,drawing`;
    script.async = true;
    script.defer = true;
    script.dataset.panthernavGoogle = "true";
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });

  return window.pantherNavGoogleMapsPromise;
}

export function gsuBounds() {
  const google = window.google;
  return new google.maps.LatLngBounds(
    new google.maps.LatLng(GSU_CENTER.lat - 0.025, GSU_CENTER.lng - 0.025),
    new google.maps.LatLng(GSU_CENTER.lat + 0.025, GSU_CENTER.lng + 0.025)
  );
}
