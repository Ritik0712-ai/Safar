import { beforeAll, describe, it, expect, vi } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { geohashForLocation } from "geofire-common";
import { Timestamp } from "firebase-admin/firestore";
import { admin } from "@/lib/firebase/admin";
import { base, now, type Actor, type Operation } from "@/server/core";
import { createQuote } from "@/server/services/quotes";
import {
  book,
  accept,
  transition,
  pin,
  readRide,
  review,
  offers,
} from "@/server/services/rides";
import {
  createTicket,
  message,
  ticketStatus,
  getTicket,
} from "@/server/services/support";
import {
  applyCapture,
  webhook,
  order,
  receipt,
  verify,
} from "@/server/services/payments";
import { application, decision } from "@/server/services/accounts";
import { matches, reveal, secret } from "@/server/providers/pin";
import type { Account } from "@/contracts";
const db = () => admin().db;
const op = (
  a: Actor,
  name: string,
  body: unknown,
  key = randomUUID(),
): Operation => ({ actor: a, name, body, key });
async function user(
  uid: string,
  role: "rider" | "driver" | "admin" = "rider",
): Promise<Actor> {
  const profile = {
    ...base(),
    uid,
    displayName: uid + " Test",
    phone: "+919876543210",
    email: uid + "@test.invalid",
    roles:
      role === "driver"
        ? ["rider", "driver"]
        : role === "admin"
          ? ["rider", "admin"]
          : ["rider"],
    defaultWorkspace: role,
    accountStatus: "active",
    onboardingComplete: true,
    emailVerified: true,
    activeRideId: null,
    isDemo: true,
  };
  await db().doc(`users/${uid}`).set(profile);
  return {
    uid,
    email: profile.email,
    verified: true,
    admin: role === "admin",
    account: profile as unknown as Account,
    authTime: Date.now() / 1000,
  };
}
async function driver(a: Actor) {
  const location = {
    lat: 12.9716,
    lng: 77.5946,
    accuracy: 5,
    source: "gps",
    timestamp: Date.now(),
    sequence: 1,
    sessionId: randomUUID(),
  };
  await db()
    .doc(`drivers/${a.uid}`)
    .set({
      ...base(),
      uid: a.uid,
      approvalStatus: "approved",
      applicationVersion: 1,
      activeVehicleId: a.uid + "-vehicle",
      activeRideId: null,
      availability: "online",
      serviceAreaId: "bengaluru-demo",
      ratingSum: 0,
      ratingCount: 0,
      isDemo: true,
      lastLocation: {
        lat: location.lat,
        lng: location.lng,
        geohash: geohashForLocation([location.lat, location.lng]),
        updatedAt: now(),
        source: "gps",
      },
    });
  await db()
    .doc(`vehicles/${a.uid}-vehicle`)
    .set({
      ...base(),
      driverId: a.uid,
      plate: "KA01AB1234",
      make: "Maruti Suzuki",
      model: "Dzire",
      color: "White",
      seats: 4,
      approvalStatus: "approved",
      applicationVersion: 1,
    });
  await admin().rtdb.ref(`driverLocations/${a.uid}`).set(location);
  await admin().rtdb.ref(`driverPresence/${a.uid}`).set({
    online: true,
    timestamp: location.timestamp,
    sessionId: location.sessionId,
  });
}
async function requested(a: Actor) {
  const q = await createQuote(a, {
    pickup: { label: "Cubbon Park", lat: 12.9716, lng: 77.5946, source: "pin" },
    destination: {
      label: "Indiranagar",
      lat: 12.9784,
      lng: 77.6408,
      source: "pin",
    },
  });
  const request = op(a, "book", { quoteId: q.id });
  const r = await book(request);
  return { id: r.rideId, request };
}
async function completed(prefix: string) {
  const rider = await user(prefix + "-rider"),
    d = await user(prefix + "-driver", "driver");
  await driver(d);
  const { id } = await requested(rider);
  await accept(op(d, "accept", { expectedVersion: 1 }), id);
  await transition(op(d, "arrive", { expectedVersion: 2 }), id, "arrive");
  const code = (await pin(rider, id)).pin;
  await transition(
    op(d, "start", { expectedVersion: 3, pin: code }),
    id,
    "start",
  );
  await transition(op(d, "complete", { expectedVersion: 4 }), id, "complete");
  return { id, rider, driver: d };
}
describe("real emulator lifecycle, permissions and concurrency", () => {
  beforeAll(async () => {
    await fetch(
      "http://127.0.0.1:8080/emulator/v1/projects/demo-safar/databases/(default)/documents",
      { method: "DELETE" },
    );
    await admin().rtdb.ref().set(null);
  });
  it("encrypts PINs and binds their HMAC to the ride", () => {
    const s = secret("ride-a"),
      p = reveal(s);
    expect(p).toMatch(/^\d{4}$/);
    expect(s.pinCiphertext).not.toBe(p);
    expect(matches("ride-a", p, s.pinHmac)).toBe(true);
    expect(matches("ride-b", p, s.pinHmac)).toBe(false);
  });
  it("validates versioned approval, unique registrations and suspension locks", async () => {
    const d = await user("application-driver", "driver"),
      other = await user("application-other", "driver"),
      ad = await user("application-admin", "admin");
    await Promise.all([driver(d), driver(other)]);
    for (const a of [d, other])
      await db().doc(`drivers/${a.uid}`).update({
        approvalStatus: "draft",
        availability: "offline",
        activeVehicleId: null,
      });
    const body = {
      plate: "KA01ZX9876",
      make: "Maruti Suzuki",
      model: "Dzire",
      color: "White",
      seats: 4,
      intent: "submit",
      expectedVersion: 1,
    };
    await application(op(d, "application", body));
    await expect(
      application(op(other, "application", body)),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      decision(
        op(ad, "decision", {
          decision: "approve",
          reason: "",
          expectedVersion: 2,
          applicationVersion: 1,
        }),
        d.uid,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await decision(
      op(ad, "decision", {
        decision: "approve",
        reason: "",
        expectedVersion: 2,
        applicationVersion: 2,
      }),
      d.uid,
    );
    expect(
      (await db().doc(`drivers/${d.uid}`).get()).data()?.approvalStatus,
    ).toBe("approved");
    await db().doc(`drivers/${d.uid}`).update({ activeRideId: "active-test" });
    await expect(
      decision(
        op(ad, "decision", {
          decision: "suspend",
          reason: "Controlled test review",
          expectedVersion: 3,
          applicationVersion: 2,
        }),
        d.uid,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await db().doc(`drivers/${d.uid}`).update({ activeRideId: null });
  });
  it("keeps expired offers from hiding the next valid request", async () => {
    const a = await user("offers-rider"),
      d = await user("offers-driver", "driver");
    await driver(d);
    const expiry = Timestamp.fromMillis(Date.now() - 1000);
    for (let i = 0; i < 12; i++)
      await db()
        .doc(`drivers/${d.uid}/offers/old-${i}`)
        .set({ ...base(), status: "open", expiresAt: expiry });
    const { id } = await requested(a);
    expect((await offers(d)).items.map((o) => o.rideId)).toContain(id);
    await transition(
      op(a, "cancel", { expectedVersion: 1, reason: "plans_changed" }),
      id,
      "cancel",
    );
  });
  it("records authorized payments as processing without releasing debt or creating a receipt", async () => {
    const { id, rider } = await completed("authorized"),
      orderId = "order_" + id,
      paymentId = "pay_" + id;
    await db()
      .doc(`payments/${id}`)
      .update({ providerOrderId: orderId, orderCreationState: "ready" });
    const response = {
      id: paymentId,
      order_id: orderId,
      amount: 11500,
      currency: "INR",
      status: "authorized",
      captured: false,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );
    const signature = createHmac("sha256", "fixture-secret")
      .update(orderId + "|" + paymentId)
      .digest("hex");
    expect(
      (await verify(rider, { rideId: id, orderId, paymentId, signature }))
        .status,
    ).toBe("processing");
    expect((await db().doc(`rides/${id}`).get()).data()?.paymentStatus).toBe(
      "processing",
    );
    expect(
      (await db().doc(`users/${rider.uid}`).get()).data()?.activeRideId,
    ).toBe(id);
    expect((await db().doc(`receipts/${id}`).get()).exists).toBe(false);
    vi.unstubAllGlobals();
  });
  it("keeps booking idempotent, protects owners and rejects invalid PIN/cancellation", async () => {
    const rider = await user("flow-rider"),
      d = await user("flow-driver", "driver"),
      other = await user("flow-other");
    await driver(d);
    const { id, request } = await requested(rider);
    expect((await book(request)).rideId).toBe(id);
    expect(
      (await db().collection("rides").where("riderId", "==", rider.uid).get())
        .size,
    ).toBe(1);
    await expect(readRide(other, id)).rejects.toMatchObject({ status: 404 });
    await accept(op(d, "accept", { expectedVersion: 1 }), id);
    await expect(pin(d, id)).rejects.toMatchObject({ status: 404 });
    await transition(op(d, "arrive", { expectedVersion: 2 }), id, "arrive");
    await expect(
      transition(
        op(d, "start", { expectedVersion: 3, pin: "wrong" }),
        id,
        "start",
      ),
    ).rejects.toBeDefined();
    const p = (await pin(rider, id)).pin;
    await transition(
      op(d, "start", { expectedVersion: 3, pin: p }),
      id,
      "start",
    );
    await expect(
      transition(
        op(rider, "cancel", { expectedVersion: 4, reason: "plans_changed" }),
        id,
        "cancel",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await transition(op(d, "complete", { expectedVersion: 4 }), id, "complete");
    expect(
      (await db().doc(`users/${rider.uid}`).get()).data()?.activeRideId,
    ).toBe(id);
    expect(
      (await db().doc(`drivers/${d.uid}`).get()).data()?.activeRideId,
    ).toBeNull();
    expect((await db().doc(`rideSecrets/${id}`).get()).exists).toBe(false);
    await expect(receipt(rider, id)).rejects.toMatchObject({ status: 409 });
  });
  it("assigns exactly one driver in 100 concurrent acceptance trials", async () => {
    for (let i = 0; i < 100; i++) {
      const rider = await user(`race-${i}-rider`),
        a = await user(`race-${i}-driver-a`, "driver"),
        b = await user(`race-${i}-driver-b`, "driver");
      await Promise.all([driver(a), driver(b)]);
      const { id } = await requested(rider);
      const results = await Promise.allSettled([
        accept(op(a, "accept", { expectedVersion: 1 }), id),
        accept(op(b, "accept", { expectedVersion: 1 }), id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const data = (await db().doc(`rides/${id}`).get()).data()!;
      expect([a.uid, b.uid]).toContain(data.driverId);
      await transition(
        op(rider, "cancel", { expectedVersion: 2, reason: "plans_changed" }),
        id,
        "cancel",
      );
      await Promise.all([
        db().doc(`drivers/${a.uid}`).update({ availability: "offline" }),
        db().doc(`drivers/${b.uid}`).update({ availability: "offline" }),
      ]);
    }
  });
  it("applies capture once under callback/webhook races, rejects mismatches and preserves duplicate investigations", async () => {
    const { id, rider, driver: d } = await completed("pay"),
      ref = db().doc(`payments/${id}`),
      orderId = "order_" + id;
    await ref.update({ providerOrderId: orderId, orderCreationState: "ready" });
    await db()
      .doc(`providerOrders/${orderId}`)
      .set({ rideId: id, mode: "test" });
    const capture = {
      id: "pay_" + id,
      order_id: orderId,
      amount: 11500,
      currency: "INR" as const,
      status: "captured",
      captured: true,
    };
    await expect(applyCapture({ ...capture, amount: 1 })).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(
      applyCapture({ ...capture, captured: false, status: "authorized" }),
    ).rejects.toMatchObject({ status: 422 });
    const raw = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: capture } },
      }),
      eventSignature = createHmac("sha256", "fixture-webhook")
        .update(raw)
        .digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(capture)),
    );
    await Promise.all([
      applyCapture(capture),
      webhook(raw, eventSignature, "evt_" + id),
      applyCapture(capture),
    ]);
    expect((await db().doc(`payments/${id}`).get()).data()?.status).toBe(
      "paid",
    );
    expect(
      (await db().collection("earningsLedger").where("rideId", "==", id).get())
        .size,
    ).toBe(1);
    expect(
      (await db().doc(`users/${rider.uid}`).get()).data()?.activeRideId,
    ).toBeNull();
    const pdf = await receipt(rider, id);
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    await expect(
      webhook(raw, "0".repeat(64), "bad-event"),
    ).rejects.toMatchObject({ status: 401 });
    await applyCapture({ ...capture, id: "duplicate_" + id });
    expect(
      (await db().doc(`payments/${id}`).get()).data()?.capturedPaymentId,
    ).toBe(capture.id);
    expect((await db().doc(`payments/${id}`).get()).data()?.status).toBe(
      "review_required",
    );
    expect(
      (await db().doc(`users/${rider.uid}`).get()).data()?.activeRideId,
    ).toBeNull();
    const reviewOp = op(rider, "review", {
      stars: 4,
      comment: "Smooth journey.",
    });
    await Promise.all([review(reviewOp, id), review(reviewOp, id)]);
    expect((await db().doc(`drivers/${d.uid}`).get()).data()?.ratingCount).toBe(
      1,
    );
    vi.unstubAllGlobals();
  });
  it("acknowledges signed unrelated orders without provider requests or financial writes", async () => {
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_unrelated",
            order_id: "order_unrelated",
            amount: 100,
            currency: "INR",
            status: "captured",
            captured: true,
          },
        },
      },
    });
    const signature = createHmac("sha256", "fixture-webhook")
      .update(raw)
      .digest("hex");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(
        webhook(raw, "0".repeat(64), "evt_unrelated"),
      ).rejects.toMatchObject({ status: 401 });
      await expect(webhook(raw, signature, "evt_unrelated")).resolves.toEqual({
        received: true,
        ignored: true,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        (await db().doc("providerPayments/pay_unrelated").get()).exists,
      ).toBe(false);
      expect((await db().doc("webhookEvents/evt_unrelated").get()).exists).toBe(
        false,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does not recreate provider orders after an ambiguous creation timeout", async () => {
    const { id, rider } = await completed("ambiguous");
    const fetchMock = vi.fn(async () => {
      throw new Error("timeout");
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = op(rider, "order", {});
    await expect(order(request, id)).rejects.toMatchObject({ status: 502 });
    await expect(order(op(rider, "order", {}), id)).rejects.toMatchObject({
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (await db().doc(`payments/${id}`).get()).data()?.orderCreationState,
    ).toBe("uncertain");
    vi.unstubAllGlobals();
  });
  it("preserves private support conversations and resolves only after an admin response", async () => {
    const a = await user("support-owner"),
      b = await user("support-other"),
      ad = await user("support-admin", "admin");
    const creation = op(a, "ticket", {
      category: "account",
      subject: "Driver account assistance",
      body: "Please help me understand the application process.",
      rideId: null,
      workspace: "rider",
    });
    const ticket = await createTicket(creation);
    expect((await createTicket(creation)).ticketId).toBe(ticket.ticketId);
    await expect(getTicket(b, ticket.ticketId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      ticketStatus(
        op(ad, "status", { target: "resolved", expectedVersion: 1 }),
        ticket.ticketId,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await message(
      op(ad, "message", {
        body: "Open your profile and start a driver application.",
      }),
      ticket.ticketId,
    );
    await ticketStatus(
      op(ad, "status", { target: "resolved", expectedVersion: 2 }),
      ticket.ticketId,
    );
    await expect(
      message(op(a, "message", { body: "More details" }), ticket.ticketId),
    ).rejects.toMatchObject({ status: 409 });
    await ticketStatus(
      op(a, "status", { target: "open", expectedVersion: 3 }),
      ticket.ticketId,
    );
    expect((await getTicket(a, ticket.ticketId)).messages).toHaveLength(2);
  });
});
