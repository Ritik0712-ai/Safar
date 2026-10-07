import type { Fare, Place, RideStatus } from "@/contracts";
export const area = {
  id: "bengaluru-demo",
  name: "Bengaluru",
  center: { lat: 12.9716, lng: 77.5946 },
  radiusMeters: 25000,
  timezone: "Asia/Kolkata",
};
export function distance(
  a: Pick<Place, "lat" | "lng">,
  b: Pick<Place, "lat" | "lng">,
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function fare(distanceMeters: number, durationSeconds: number): Fare {
  const basePaise = 4000,
    distanceChargePaise = Math.round((distanceMeters * 1200) / 1000),
    timeChargePaise = Math.round((durationSeconds * 100) / 60),
    raw = basePaise + distanceChargePaise + timeChargePaise,
    totalPaise = Math.ceil(Math.max(8000, raw) / 100) * 100;
  return {
    basePaise,
    distanceChargePaise,
    timeChargePaise,
    totalPaise,
    roundingPaise: totalPaise - raw,
    distanceRatePaisePerKm: 1200,
    timeRatePaisePerMinute: 100,
    minimumPaise: 8000,
    commissionBps: 2000,
    policyVersion: "demo-v1",
    currency: "INR",
  };
}
export const terminal = (s: RideStatus) =>
  ["completed", "cancelled", "expired"].includes(s);
export const canCancel = (s: RideStatus) =>
  ["searching", "assigned", "arrived"].includes(s);
export function safeNext(next: string | null | undefined, fallback = "/rider") {
  return next &&
    /^\/(rider|driver|admin)(\/[^?#\\]*)?(\?[^\\]*)?$/.test(next) &&
    !next.includes("//")
    ? next
    : fallback;
}
