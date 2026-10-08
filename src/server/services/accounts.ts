import "server-only";
import { z } from "zod";
import { admin } from "@/lib/firebase/admin";
import {
  onboardSchema,
  profileSchema,
  vehicleSchema,
  versionSchema,
  initials,
  type Account,
  type Driver,
  type Vehicle,
} from "@/contracts";
import {
  base,
  updated,
  atomic,
  ensure,
  role,
  checkVersion,
  audit,
  now,
  type Actor,
  type Operation,
  dto,
} from "@/server/core";
export async function me(a: Actor) {
  const user = await admin().auth.getUser(a.uid);
  return {
    profile: a.account
      ? { ...a.account, emailVerified: user.emailVerified }
      : null,
    needsOnboarding: !a.account,
    identity: {
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    },
    driver: a.account?.roles.includes("driver") ? await driver(a) : null,
  };
}
export async function onboard(op: Operation) {
  const b = onboardSchema.parse(op.body),
    a = op.actor;
  return atomic(op, async (t) => {
    const ref = admin().db.doc(`users/${a.uid}`),
      old = await t.get(ref);
    if (old.exists) {
      const profile = dto<Account>(old);
      if (b.intent === "driver" && !profile.roles.includes("driver")) {
        t.update(ref, {
          roles: [...profile.roles, "driver"],
          ...updated(profile.version),
        });
        t.create(admin().db.doc(`drivers/${a.uid}`), {
          ...base(),
          uid: a.uid,
          approvalStatus: "draft",
          applicationVersion: 1,
          activeVehicleId: null,
          availability: "offline",
          activeRideId: null,
          serviceAreaId: "bengaluru-demo",
          ratingSum: 0,
          ratingCount: 0,
          isDemo: profile.isDemo,
          accessSyncVersion: 1,
          accessSyncPending: false,
        });
      }
      return { uid: a.uid };
    }
    t.create(ref, {
      ...base(),
      uid: a.uid,
      displayName: b.displayName,
      phone: b.phone,
      email: a.email,
      emailVerified: a.verified,
      roles: b.intent === "driver" ? ["rider", "driver"] : ["rider"],
      defaultWorkspace: b.intent,
      accountStatus: "active",
      onboardingComplete: true,
      activeRideId: null,
      termsVersion: "demo-v1",
      termsAcceptedAt: now(),
      isDemo: false,
    });
    if (b.intent === "driver")
      t.create(admin().db.doc(`drivers/${a.uid}`), {
        ...base(),
        uid: a.uid,
        approvalStatus: "draft",
        applicationVersion: 1,
        activeVehicleId: null,
        availability: "offline",
        activeRideId: null,
        serviceAreaId: "bengaluru-demo",
        ratingSum: 0,
        ratingCount: 0,
        isDemo: false,
        accessSyncVersion: 1,
        accessSyncPending: false,
      });
    return { uid: a.uid };
  });
}
export async function profile(a: Actor, body: unknown) {
  const b = profileSchema
    .extend({
      defaultWorkspace: z.enum(["rider", "driver", "admin"]).optional(),
    })
    .strict()
    .parse(body);
  ensure(a.account, 403, "ONBOARDING_REQUIRED", "Complete your profile first.");
  if (b.defaultWorkspace) role(a, b.defaultWorkspace);
  await admin()
    .db.doc(`users/${a.uid}`)
    .update({ ...b, ...updated(a.account.version) });
  return { saved: true };
}
export async function driver(a: Actor) {
  role(a, "driver");
  const doc = await admin().db.doc(`drivers/${a.uid}`).get();
  const d = dto<Driver>(doc);
  const vehicle = d.activeVehicleId
    ? await admin().db.doc(`vehicles/${d.activeVehicleId}`).get()
    : null;
  return {
    ...d,
    vehicle: vehicle?.exists ? dto<Vehicle>(vehicle) : undefined,
    simulationAllowed:
      d.isDemo &&
      process.env.DEMO_MODE === "true" &&
      process.env.APP_ENV !== "production" &&
      process.env.DEMO_DRIVER_UIDS?.split(",").includes(a.uid) === true,
  };
}
export async function application(op: Operation) {
  const a = op.actor;
  role(a, "driver");
  const b = vehicleSchema
    .extend({
      intent: z.enum(["draft", "submit"]),
      expectedVersion: z.number().int().min(1),
    })
    .strict()
    .parse(op.body);
  return atomic(op, async (t) => {
    const dr = admin().db.doc(`drivers/${a.uid}`),
      dd = await t.get(dr),
      d = dto<Driver>(dd);
    checkVersion(d, b.expectedVersion);
    ensure(
      !d.activeRideId,
      409,
      "ACTIVE_TRIP",
      "Finish your trip before changing your vehicle.",
    );
    const plate = b.plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
    ensure(
      /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/.test(
        plate,
      ),
      422,
      "INVALID_PLATE",
      "Enter a valid vehicle registration format.",
    );
    const reservation = admin().db.doc(`vehiclePlates/${plate}`),
      reserved = await t.get(reservation);
    ensure(
      !reserved.exists || reserved.data()?.driverId === a.uid,
      409,
      "PLATE_RESERVED",
      "This registration is already attached to another driver.",
    );
    const vehicleId =
        d.activeVehicleId ?? admin().db.collection("vehicles").doc().id,
      vref = admin().db.doc(`vehicles/${vehicleId}`),
      vold = await t.get(vref);
    const applicationVersion = d.applicationVersion + 1,
      approvalStatus = b.intent === "submit" ? "pending" : "draft";
    const vehicle = {
      plate: b.plate.toUpperCase(),
      normalizedPlate: plate,
      make: b.make,
      model: b.model,
      color: b.color,
      seats: 4,
      rideType: "economy",
      driverId: a.uid,
      approvalStatus,
      applicationVersion,
      isDemo: d.isDemo,
    };
    t.set(
      vref,
      {
        ...(vold.exists ? { ...updated(vold.data()!.version) } : base()),
        ...vehicle,
      },
      { merge: true },
    );
    if (!reserved.exists)
      t.create(reservation, {
        schemaVersion: 1,
        createdAt: now(),
        vehicleId,
        driverId: a.uid,
      });
    t.update(dr, {
      ...updated(d.version),
      applicationVersion,
      approvalStatus,
      activeVehicleId: vehicleId,
      availability: "offline",
      submittedAt: now(),
    });
    audit(t, a, "driver_resubmit", a.uid, d.approvalStatus, approvalStatus);
    return { approvalStatus, vehicleId };
  });
}
export async function decision(op: Operation, uid: string) {
  role(op.actor, "admin");
  const b = versionSchema
    .extend({
      applicationVersion: z.number().int().min(1),
      decision: z.enum(["approve", "reject", "suspend"]),
      reason: z.string().max(500).default(""),
    })
    .strict()
    .parse(op.body);
  if (b.decision !== "approve")
    ensure(
      b.reason.trim().length >= 5,
      422,
      "REASON_REQUIRED",
      "Give a reason of at least five characters.",
    );
  const result = await atomic(op, async (t) => {
    const dr = admin().db.doc(`drivers/${uid}`),
      dd = await t.get(dr),
      d = dto<Driver>(dd);
    checkVersion(d, b.expectedVersion);
    ensure(
      d.applicationVersion === b.applicationVersion,
      409,
      "APPLICATION_CHANGED",
      "The application changed. Review it again.",
    );
    ensure(
      d.activeVehicleId,
      409,
      "NO_VEHICLE",
      "No vehicle has been submitted.",
    );
    const vr = admin().db.doc(`vehicles/${d.activeVehicleId}`),
      vd = await t.get(vr),
      v = dto<Vehicle>(vd);
    ensure(
      v.applicationVersion === b.applicationVersion,
      409,
      "APPLICATION_CHANGED",
      "Vehicle information changed.",
    );
    ensure(
      !d.activeRideId,
      409,
      "ACTIVE_TRIP",
      "An active trip prevents this decision.",
    );
    ensure(
      b.decision === "suspend"
        ? d.approvalStatus === "approved"
        : d.approvalStatus === "pending",
      409,
      "INVALID_DECISION",
      "This application cannot receive that decision.",
    );
    const approvalStatus =
      b.decision === "approve"
        ? "approved"
        : b.decision === "reject"
          ? "rejected"
          : "suspended";
    t.update(dr, {
      ...updated(d.version),
      approvalStatus,
      reviewReason: b.reason,
      reviewedBy: op.actor.uid,
      reviewedAt: now(),
      availability: "offline",
    });
    t.update(vr, {
      ...updated(vd.data()!.version),
      approvalStatus:
        approvalStatus === "suspended" ? "retired" : approvalStatus,
    });
    audit(
      t,
      op.actor,
      `driver_${b.decision}`,
      uid,
      d.approvalStatus,
      approvalStatus,
      b.reason,
    );
    return { approvalStatus };
  });
  await admin().rtdb.ref(`driverAccess/${uid}`).remove();
  return result;
}
export const person = (a: Account) => ({
  uid: a.uid,
  displayName: a.displayName,
  initials: initials(a.displayName),
});
