import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { geohashForLocation } from "geofire-common";
import { admin } from "@/lib/firebase/admin";
import { locationSchema, type Driver, type Location } from "@/contracts";
import { area, distance } from "@/lib/domain";
import { role, ensure, dto, now, updated, type Actor } from "@/server/core";
export function simulationAllowed(uid: string) {
  return (
    process.env.DEMO_MODE === "true" &&
    process.env.APP_ENV !== "production" &&
    !process.env.VERCEL_ENV?.includes("production") &&
    process.env.DEMO_DRIVER_UIDS?.split(",").includes(uid) === true
  );
}
export async function heartbeat(a: Actor, body: unknown) {
  role(a, "driver", true);
  const b = locationSchema.parse(body);
  ensure(
    b.source !== "simulation" || simulationAllowed(a.uid),
    403,
    "SIMULATION_FORBIDDEN",
    "Simulated location is unavailable.",
  );
  ensure(
    Math.abs(Date.now() - b.timestamp) <= 10000,
    422,
    "STALE_LOCATION",
    "Get a fresh location before continuing.",
  );
  ensure(
    distance(b, area.center) <= area.radiusMeters,
    422,
    "OUTSIDE_SERVICE_AREA",
    "Driving is available within central Bengaluru.",
  );
  const dref = admin().db.doc(`drivers/${a.uid}`);
  const old = await admin().rtdb.ref(`driverLocations/${a.uid}`).get();
  if (old.exists() && old.val().sessionId === b.sessionId)
    ensure(
      b.sequence > old.val().sequence,
      409,
      "LOCATION_OUT_OF_ORDER",
      "A newer location has already been received.",
    );
  await admin().db.runTransaction(async (t) => {
    const dd = await t.get(dref),
      d = dto<Driver>(dd),
      user = await t.get(admin().db.doc(`users/${a.uid}`));
    ensure(
      d.approvalStatus === "approved",
      403,
      "APPROVAL_REQUIRED",
      "Your vehicle must be approved before driving.",
    );
    ensure(
      !user.data()?.activeRideId,
      409,
      "PASSENGER_RIDE_ACTIVE",
      "Finish your passenger ride and payment before driving.",
    );
    t.update(dref, {
      lastLocation: {
        lat: b.lat,
        lng: b.lng,
        geohash: geohashForLocation([b.lat, b.lng]),
        updatedAt: now(),
        source: b.source,
      },
      sessionId: b.sessionId,
      updatedAt: now(),
    });
  });
  const d = dto<Driver>(await dref.get());
  await admin()
    .rtdb.ref(`driverAccess/${a.uid}`)
    .set({
      approved: true,
      trackingAllowed: true,
      simulationAllowed: simulationAllowed(a.uid),
      sessionId: b.sessionId,
      expiresAt: Date.now() + 90000,
    });
  await admin().rtdb.ref(`driverLocations/${a.uid}`).set(b);
  await admin()
    .rtdb.ref(`driverPresence/${a.uid}`)
    .set({
      online: d.availability !== "offline",
      timestamp: b.timestamp,
      sessionId: b.sessionId,
    });
  if (d.activeRideId) {
    await syncRide(d.activeRideId);
    await admin()
      .rtdb.ref(`rideTracking/${d.activeRideId}`)
      .set({ ...b, driverId: a.uid });
  }
  return { sessionId: b.sessionId };
}
export async function availability(a: Actor, body: unknown) {
  role(a, "driver", true);
  const b = z.object({ online: z.boolean() }).strict().parse(body);
  if (b.online) await fresh(a.uid);
  await admin().db.runTransaction(async (t) => {
    const dref = admin().db.doc(`drivers/${a.uid}`),
      dd = await t.get(dref),
      d = dto<Driver>(dd),
      u = await t.get(admin().db.doc(`users/${a.uid}`));
    ensure(
      d.approvalStatus === "approved",
      403,
      "APPROVAL_REQUIRED",
      "Approval is required before going online.",
    );
    ensure(
      !b.online || !u.data()?.activeRideId,
      409,
      "PASSENGER_RIDE_ACTIVE",
      "Finish your passenger ride and payment first.",
    );
    ensure(
      !b.online || !d.activeRideId,
      409,
      "ACTIVE_TRIP",
      "Continue your active trip first.",
    );
    t.update(dref, {
      availability: b.online ? "online" : "offline",
      ...updated(d.version),
    });
  });
  await admin()
    .rtdb.ref(`driverPresence/${a.uid}`)
    .update({ online: b.online, timestamp: Date.now() });
  if (!b.online) {
    const d = dto<Driver>(await admin().db.doc(`drivers/${a.uid}`).get());
    if (!d.activeRideId)
      await admin().rtdb.ref(`driverAccess/${a.uid}`).remove();
  }
  return { availability: b.online ? "online" : "offline" };
}
export async function fresh(
  uid: string,
  requireOnline = false,
): Promise<Location> {
  const [l, p] = await Promise.all([
    admin().rtdb.ref(`driverLocations/${uid}`).get(),
    admin().rtdb.ref(`driverPresence/${uid}`).get(),
  ]);
  const value = l.val();
  ensure(
    value &&
      Date.now() - value.timestamp <= 15000 &&
      value.timestamp <= Date.now() + 10000,
    409,
    "FRESH_LOCATION_REQUIRED",
    "Refresh your location before going online or accepting.",
  );
  ensure(
    value.source !== "simulation" || simulationAllowed(uid),
    403,
    "SIMULATION_FORBIDDEN",
    "Simulated location is unavailable.",
  );
  ensure(
    p.exists() &&
      p.val().sessionId === value.sessionId &&
      (!requireOnline || p.val().online === true),
    409,
    "PRESENCE_REQUIRED",
    "Reconnect your location before continuing.",
  );
  return locationSchema.parse(value);
}
export async function syncRide(id: string) {
  const rref = admin().db.doc(`rides/${id}`),
    doc = await rref.get();
  if (!doc.exists) return;
  const r = doc.data()!;
  try {
    const trackingEnabled = ["assigned", "arrived", "in_progress"].includes(
      r.status,
    );
    const participants = trackingEnabled
      ? await admin().db.getAll(
          admin().db.doc(`users/${r.riderId}`),
          admin().db.doc(`users/${r.driverId}`),
        )
      : [];
    const allowed =
      trackingEnabled &&
      participants.every((d) => d.data()?.accountStatus === "active");
    const mirror = await admin().rtdb.ref(`rideAccess/${id}`).get();
    if (
      !r.accessSyncPending &&
      mirror.exists() &&
      mirror.val().version === r.version &&
      mirror.val().trackingEnabled === allowed &&
      (!allowed || mirror.val().expiresAt > Date.now() + 15000)
    )
      return;
    await admin()
      .rtdb.ref(`rideAccess/${id}`)
      .transaction((old) =>
        !old || old.version <= r.version
          ? {
              riderId: r.riderId,
              driverId: r.driverId ?? "",
              trackingEnabled: allowed,
              version: r.version,
              expiresAt: Date.now() + (allowed ? 75000 : 0),
            }
          : undefined,
      );
    if (!allowed) {
      await admin().rtdb.ref(`rideTracking/${id}`).remove();
      if (r.driverId) {
        const d = await admin().db.doc(`drivers/${r.driverId}`).get();
        if (!d.data()?.activeRideId && d.data()?.availability === "offline")
          await Promise.all([
            admin().rtdb.ref(`driverAccess/${r.driverId}`).remove(),
            admin().rtdb.ref(`driverLocations/${r.driverId}`).remove(),
            admin().rtdb.ref(`driverPresence/${r.driverId}`).remove(),
          ]);
      }
    }
    if (r.accessSyncPending)
      await admin().db.runTransaction(async (t) => {
        const latest = await t.get(rref);
        if (latest.data()?.version === r.version)
          t.update(rref, { accessSyncPending: false });
      });
  } catch {
    await rref.update({ accessSyncPending: true });
  }
}
export async function candidateDrivers(
  pickup: {
    lat: number;
    lng: number;
  },
  riderId: string,
) {
  const { geohashQueryBounds } = await import("geofire-common");
  const bounds = geohashQueryBounds([pickup.lat, pickup.lng], 5000),
    db = admin().db;
  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db
        .collection("drivers")
        .where("approvalStatus", "==", "approved")
        .where("availability", "==", "online")
        .where("serviceAreaId", "==", area.id)
        .orderBy("lastLocation.geohash")
        .startAt(start)
        .endAt(end)
        .limit(30)
        .get(),
    ),
  );
  const all = new Map(
    snapshots.flatMap((s) => s.docs).map((d) => [d.id, dto<Driver>(d)]),
  );
  return [...all.values()]
    .filter(
      (d) =>
        d.uid !== riderId &&
        !d.activeRideId &&
        d.lastLocation &&
        Date.now() - Date.parse(d.lastLocation.updatedAt) <= 75000 &&
        (d.lastLocation.source !== "simulation" || simulationAllowed(d.uid)) &&
        distance(d.lastLocation, pickup) <= 5000,
    )
    .sort(
      (a, b) =>
        distance(a.lastLocation!, pickup) - distance(b.lastLocation!, pickup) ||
        a.uid.localeCompare(b.uid),
    )
    .slice(0, 10)
    .map((d) => d.uid);
}
export function newLocationSession() {
  return randomUUID();
}
