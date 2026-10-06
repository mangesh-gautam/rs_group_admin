import type { Coordinates } from "./types";

/**
 * Reads the device's coordinates via the browser Geolocation API. Every
 * Admin / Super Admin sign-in sends them; auth-service rejects sign-ins
 * without them. Geolocation only works on HTTPS or localhost.
 */
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share your location, which is required to sign in."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location access is required to sign in. Allow location for this site in your browser and try again."
              : "We couldn't get your location. Check that location services are on and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export const formatLocation = (loc: Coordinates | null) =>
  loc
    ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}${
        loc.accuracy != null ? ` (±${Math.round(loc.accuracy)} m)` : ""
      }`
    : "—";
