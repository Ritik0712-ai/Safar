import "server-only";
import { z } from "zod";
import {
  AggregateField,
  Timestamp,
  type Query,
} from "firebase-admin/firestore";
import { admin } from "@/lib/firebase/admin";
import { type Driver, type Vehicle, type Ride, type Ledger } from "@/contracts";
import {
  role,
  page,
  dto,
  ensure,
  atomic,
  audit,
  now,
  type Actor,
  type Operation,
} from "@/server/core";
export async function overview(a: Actor) {
  role(a, "admin");
  const db = admin().db;
  const results = await Promise.all([
    db
      .collection("drivers")
      .where("approvalStatus", "==", "pending")
      .count()
      .get(),
    db
      .collection("rides")
      .where("status", "in", [
        "searching",
        "assigned",
        "arrived",
        "in_progress",
      ])
      .count()
      .get(),
    db
      .collection("rides")
      .where("paymentStatus", "==", "review_required")
      .count()
      .get(),
    db
      .collection("supportTickets")
      .where("status", "in", ["open", "in_progress"])
      .count()
      .get(),
  ]);
  return {
    applications: results[0].data().count,
    activeRides: results[1].data().count,
    paymentAttention: results[2].data().count,
    openTickets: results[3].data().count,
  };
}
export async function inspectDriver(a: Actor, uid: string) {
  role(a, "admin");
  const doc = await admin().db.doc(`drivers/${uid}`).get(),
    d = dto<Driver>(doc),
    u = await admin().db.doc(`users/${uid}`).get(),
    v = d.activeVehicleId
      ? await admin().db.doc(`vehicles/${d.activeVehicleId}`).get()
      : null;
  return {
    ...d,
    displayName: u.data()?.displayName,
    vehicle: v?.exists ? dto<Vehicle>(v) : null,
  };
}
export async function drivers(
  a: Actor,
  status: string,
  cursor: string | null,
  exact: string | null,
) {
  role(a, "admin");
  if (exact) {
    let uid = exact;
    const reservation = await admin()
      .db.doc(`vehiclePlates/${exact.replace(/[^a-z0-9]/gi, "").toUpperCase()}`)
      .get();
    if (reservation.exists) uid = reservation.data()!.driverId;
    return { items: [await inspectDriver(a, uid)], nextCursor: null };
  }
  const p = await page<Driver>(
    admin()
      .db.collection("drivers")
      .where(
        "approvalStatus",
        "==",
        z.enum(["pending", "approved", "rejected", "suspended"]).parse(status),
      ),
    `${a.uid}:drivers:${status}`,
    cursor,
  );
  return {
    ...p,
    items: await Promise.all(p.items.map((d) => inspectDriver(a, d.uid))),
  };
}
export async function adminRides(
  a: Actor,
  status: string | null,
  cursor: string | null,
  exact: string | null,
) {
  role(a, "admin");
  if (exact) {
    const doc = await admin().db.doc(`rides/${exact}`).get();
    return { items: [dto<Ride>(doc)], nextCursor: null };
  }
  let q: Query = admin().db.collection("rides");
  if (status === "active")
    q = q.where("status", "in", ["assigned", "arrived", "in_progress"]);
  else if (status === "attention")
    q = q.where("paymentStatus", "in", [
      "processing",
      "failed",
      "review_required",
    ]);
  else if (status && status !== "all")
    q = q.where(
      "status",
      "==",
      z.enum(["searching", "completed", "cancelled", "expired"]).parse(status),
    );
  return page<Ride>(q, `${a.uid}:adminRides:${status}`, cursor);
}
function indiaMidnight() {
  const d = new Date(Date.now() + 330 * 60000);
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 330 * 60000
  );
}
export async function earnings(a: Actor, range: string, cursor: string | null) {
  role(a, "driver");
  const db = admin().db;
  let q = db.collection("earningsLedger").where("driverId", "==", a.uid);
  if (range === "today")
    q = q.where("capturedAt", ">=", Timestamp.fromMillis(indiaMidnight()));
  if (range === "last7")
    q = q.where(
      "capturedAt",
      ">=",
      Timestamp.fromMillis(indiaMidnight() - 6 * 86400000),
    );
  const pending = db
    .collection("payments")
    .where("driverId", "==", a.uid)
    .where("status", "in", [
      "pending",
      "processing",
      "failed",
      "review_required",
    ])
    .where("capturedPaymentId", "==", null);
  const [p, total, pendingTotal, today] = await Promise.all([
    page<Ledger>(q, `${a.uid}:earnings:${range}`, cursor, "capturedAt"),
    q.aggregate({ total: AggregateField.sum("driverSharePaise") }).get(),
    pending.aggregate({ total: AggregateField.sum("driverSharePaise") }).get(),
    db
      .collection("rides")
      .where("driverId", "==", a.uid)
      .where("status", "==", "completed")
      .where("completedAt", ">=", Timestamp.fromMillis(indiaMidnight()))
      .count()
      .get(),
  ]);
  return {
    ...p,
    totalPaise: total.data().total,
    pendingPaise: pendingTotal.data().total,
    todayTrips: today.data().count,
  };
}
export async function resetDemo(op: Operation) {
  role(op.actor, "admin");
  ensure(
    process.env.DEMO_MODE === "true" && process.env.APP_ENV !== "production",
    403,
    "DEMO_UNAVAILABLE",
    "Demo tools are unavailable.",
  );
  const b = z
    .object({
      confirmation: z.literal("RESET DEMO"),
      rideIds: z.array(z.string().max(128)).min(1).max(20),
    })
    .strict()
    .parse(op.body);
  return atomic(op, async (t) => {
    const refs = b.rideIds.map((id) => admin().db.doc(`rides/${id}`)),
      docs = await t.getAll(...refs),
      payments = await t.getAll(
        ...b.rideIds.map((id) => admin().db.doc(`payments/${id}`)),
      ),
      users = await t.getAll(
        ...docs
          .filter((d) => d.exists)
          .map((d) => admin().db.doc(`users/${d.data()!.riderId}`)),
      );
    docs.forEach((d, i) => {
      ensure(
        d.exists &&
          d.data()?.isDemo &&
          ["cancelled", "expired", "completed"].includes(d.data()!.status),
        409,
        "UNSAFE_RESET",
        "Only terminal demo rides can be reset.",
      );
      ensure(
        !payments[i].data()?.capturedPaymentId,
        409,
        "CAPTURED_HISTORY",
        "Captured payment history cannot be reset.",
      );
    });
    docs.forEach((d, i) => {
      t.delete(refs[i]);
      t.delete(admin().db.doc(`rideSecrets/${d.id}`));
      if (payments[i].exists) t.delete(payments[i].ref);
      const user = users.find((u) => u.id === d.data()!.riderId);
      if (user?.data()?.activeRideId === d.id)
        t.update(user.ref, { activeRideId: null, updatedAt: now() });
    });
    audit(t, op.actor, "demo_reset", b.rideIds.join(","), "terminal", "reset");
    return { resetCount: docs.length };
  });
}
