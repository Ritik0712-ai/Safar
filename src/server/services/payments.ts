import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { admin } from "@/lib/firebase/admin";
import { type Payment, type Ride } from "@/contracts";
import {
  ensure,
  AppError,
  dto,
  now,
  future,
  updated,
  base,
  atomic,
  hash,
  type Actor,
  type Operation,
} from "@/server/core";
import { authorizeRide } from "./rides";
function credentials() {
  ensure(
    process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.PAYMENT_MODE === "test",
    503,
    "PAYMENT_UNAVAILABLE",
    "Test checkout is being connected. Your ride and agreed fare are saved.",
  );
  return {
    id: process.env.RAZORPAY_KEY_ID,
    secret: process.env.RAZORPAY_KEY_SECRET,
  };
}
async function provider(path: string, body?: unknown) {
  const c = credentials();
  let origin = "https://api.razorpay.com/v1/";
  if (
    process.env.TEST_PAYMENT_PROVIDER_URL &&
    process.env.APP_ENV === "test" &&
    process.env.FIRESTORE_EMULATOR_HOST &&
    process.env.TEST_PROVIDER_FIXTURES === "true" &&
    !process.env.VERCEL
  ) {
    const fixture = new URL(process.env.TEST_PAYMENT_PROVIDER_URL);
    ensure(
      fixture.protocol === "http:" && fixture.hostname === "127.0.0.1",
      503,
      "INVALID_TEST_PROVIDER",
      "Test provider configuration is unavailable.",
    );
    origin = fixture.toString();
  }
  let res;
  try {
    res = await fetch(new URL(path, origin), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "Payment could not be confirmed. Check its status before retrying.",
      true,
    );
  }
  ensure(
    res.ok,
    502,
    "PAYMENT_PROVIDER_UNAVAILABLE",
    "The payment provider could not complete this request.",
  );
  return res.json();
}
export const captureSchema = z.object({
  id: z.string().max(128),
  order_id: z.string().max(128),
  amount: z.number().int(),
  currency: z.literal("INR"),
  status: z.string(),
  captured: z.boolean(),
});
export type Capture = z.infer<typeof captureSchema>;
function signature(message: string, sig: string, key: string) {
  const expected = createHmac("sha256", key).update(message).digest("hex");
  return (
    /^[a-f0-9]{64}$/i.test(sig) &&
    timingSafeEqual(Buffer.from(sig.toLowerCase()), Buffer.from(expected))
  );
}
export async function order(op: Operation, id: string) {
  const c = credentials();
  const a = op.actor,
    doc = await authorizeRide(a, id);
  ensure(
    doc.data()?.riderId === a.uid && doc.data()?.status === "completed",
    404,
    "PAYMENT_UNAVAILABLE",
    "Payment is available after your completed ride.",
  );
  const ref = admin().db.doc(`payments/${id}`);
  const lease = randomUUID();
  const reserved = await atomic(op, async (t) => {
    const pd = await t.get(ref),
      p = dto<Payment>(pd);
    ensure(
      !p.capturedPaymentId && p.status !== "review_required",
      409,
      "PAYMENT_ALREADY_SETTLED",
      "Check the current payment status.",
    );
    if (p.providerOrderId) return { providerOrderId: p.providerOrderId };
    ensure(
      p.orderCreationState === "not_started",
      409,
      "ORDER_PENDING",
      "Order creation needs reconciliation. Check status or contact support.",
    );
    t.update(ref, {
      orderCreationState: "creating",
      creationOperationId: lease,
      creationLeaseUntil: future(60000),
      ...updated(pd.data()!.version),
    });
    return { providerOrderId: null };
  });
  let orderId = reserved.providerOrderId;
  if (!orderId) {
    const before = await ref.get();
    if (before.data()?.providerOrderId)
      orderId = before.data()!.providerOrderId;
    else {
      ensure(
        before.data()?.creationOperationId === lease,
        409,
        "ORDER_PENDING",
        "Checkout is being prepared. Check status before retrying.",
      );
      try {
        const data = z
          .object({
            id: z.string(),
            amount: z.number().int(),
            currency: z.literal("INR"),
          })
          .parse(
            await provider("orders", {
              amount: before.data()!.amountPaise,
              currency: "INR",
              receipt: before.data()!.providerReceipt,
              notes: { rideId: id },
              partial_payment: false,
            }),
          );
        ensure(
          data.amount === before.data()!.amountPaise,
          502,
          "ORDER_MISMATCH",
          "The provider order did not match the fare.",
        );
        await admin().db.runTransaction(async (t) => {
          const pd = await t.get(ref);
          ensure(
            !pd.data()?.providerOrderId,
            409,
            "ORDER_CONFLICT",
            "A checkout already exists.",
          );
          t.update(ref, {
            providerOrderId: data.id,
            orderCreationState: "ready",
            ...updated(pd.data()!.version),
          });
          t.create(admin().db.doc(`providerOrders/${data.id}`), {
            schemaVersion: 1,
            createdAt: now(),
            paymentId: id,
            rideId: id,
            riderId: a.uid,
            mode: "test",
            amountPaise: data.amount,
            currency: "INR",
          });
        });
        orderId = data.id;
      } catch (e) {
        await ref.update({
          orderCreationState: "uncertain",
          status: "review_required",
          reviewReasonCode: "order_creation_uncertain",
        });
        await doc.ref.update({ paymentStatus: "review_required" });
        throw e;
      }
    }
  }
  const payment = dto<Payment>(await ref.get());
  return {
    paymentId: id,
    providerOrderId: orderId,
    checkoutKeyId: c.id,
    amountPaise: payment.amountPaise,
    currency: "INR",
    mode: "test",
    status: payment.status,
  };
}
export async function applyCapture(
  capture: Capture,
  event?: {
    id: string;
    payloadHash: string;
    eventType: string;
  },
) {
  ensure(
    capture.status === "captured" && capture.captured,
    422,
    "NOT_CAPTURED",
    "This payment has not been captured.",
  );
  credentials();
  const map = await admin().db.doc(`providerOrders/${capture.order_id}`).get();
  ensure(
    map.exists && map.data()?.mode === "test",
    422,
    "ORDER_MISMATCH",
    "The payment order is unavailable.",
  );
  const id = map.data()!.rideId as string;
  return admin().db.runTransaction(async (t) => {
    const db = admin().db,
      pr = db.doc(`payments/${id}`),
      rr = db.doc(`rides/${id}`),
      mr = db.doc(`providerPayments/${capture.id}`),
      er = event ? db.doc(`webhookEvents/${event.id}`) : null;
    const [pd, rd, md] = await t.getAll(pr, rr, mr),
      ed = er ? await t.get(er) : null,
      p = dto<Payment>(pd),
      r = dto<Ride>(rd),
      ur = db.doc(`users/${r.riderId}`),
      ud = await t.get(ur);
    if (ed?.exists) {
      ensure(
        ed.data()?.payloadHash === event!.payloadHash,
        409,
        "EVENT_MISMATCH",
        "The webhook identity is inconsistent.",
      );
      if (ed.data()?.status === "processed") return { status: p.status };
    }
    ensure(
      r.status === "completed" &&
        p.providerOrderId === capture.order_id &&
        p.amountPaise === capture.amount &&
        p.currency === capture.currency &&
        pd.data()?.mode === "test",
      422,
      "PAYMENT_MISMATCH",
      "The payment does not match this ride.",
    );
    if (md.exists)
      ensure(
        md.data()?.rideId === id &&
          md.data()?.providerOrderId === capture.order_id,
        409,
        "PAYMENT_REPLAY",
        "This payment is already associated with another ride.",
      );
    if (p.capturedPaymentId && p.capturedPaymentId !== capture.id) {
      if (!md.exists) {
        t.create(mr, {
          schemaVersion: 1,
          createdAt: now(),
          paymentId: id,
          rideId: id,
          providerOrderId: capture.order_id,
          amountPaise: capture.amount,
          mode: "test",
          captureDisposition: "duplicate_incident",
        });
        t.update(pr, {
          status: "review_required",
          reviewReasonCode: "duplicate_capture",
          ...updated(pd.data()!.version),
        });
        t.update(rr, {
          paymentStatus: "review_required",
          ...updated(r.version),
        });
        const incident = db.collection("supportTickets").doc();
        t.create(incident, {
          ...base(),
          ownerId: r.riderId,
          ownerWorkspace: "rider",
          rideId: id,
          category: "payment",
          subject: "Duplicate captured test payment",
          status: "open",
          lastMessageAt: now(),
          lastMessageBy: "system",
          hasAdminReply: false,
          isDemo: rd.data()!.isDemo,
        });
        t.create(incident.collection("messages").doc(), {
          schemaVersion: 1,
          createdAt: now(),
          ticketId: incident.id,
          authorId: "system",
          authorRole: "admin",
          body: "An additional captured test payment needs provider investigation. Your original receipt is preserved. Do not pay again.",
          requestId: randomUUID(),
        });
      }
      if (er)
        t.set(er, {
          schemaVersion: 1,
          createdAt: now(),
          provider: "razorpay",
          ...event,
          status: "processed",
          processedAt: now(),
        });
      return { status: "review_required" };
    }
    if (!p.capturedPaymentId) {
      ensure(
        r.driverSnapshot && r.vehicleSnapshot && r.completedAt,
        409,
        "INCOMPLETE_RECORD",
        "The ride record needs support review.",
      );
      if (!md.exists)
        t.create(mr, {
          schemaVersion: 1,
          createdAt: now(),
          paymentId: id,
          rideId: id,
          providerOrderId: capture.order_id,
          amountPaise: capture.amount,
          mode: "test",
          captureDisposition: "canonical",
        });
      t.update(pr, {
        capturedPaymentId: capture.id,
        status: "paid",
        capturedAt: now(),
        receiptId: id,
        ...updated(pd.data()!.version),
      });
      t.update(rr, { paymentStatus: "paid", ...updated(r.version) });
      t.create(db.doc(`receipts/${id}`), {
        schemaVersion: 1,
        createdAt: now(),
        rideId: id,
        paymentId: id,
        receiptNumber: `TEST-${id}`,
        riderId: r.riderId,
        driverId: r.driverId,
        amountPaise: p.amountPaise,
        currency: "INR",
        providerPaymentId: capture.id,
        issuedAt: now(),
        mode: "test",
        riderSnapshot: r.riderSnapshot,
        driverSnapshot: r.driverSnapshot,
        vehicleSnapshot: r.vehicleSnapshot,
        pickupLabel: r.pickup.label,
        destinationLabel: r.destination.label,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        completedAt: rd.data()!.completedAt,
      });
      t.create(db.doc(`earningsLedger/${id}`), {
        schemaVersion: 1,
        createdAt: now(),
        rideId: id,
        driverId: r.driverId,
        paymentId: id,
        providerPaymentId: capture.id,
        grossPaise: p.amountPaise,
        driverSharePaise: p.driverSharePaise,
        platformSharePaise: p.platformSharePaise,
        currency: "INR",
        capturedAt: now(),
        mode: "test",
        kind: "ride_capture",
      });
      if (ud.data()?.activeRideId === id)
        t.update(ur, { activeRideId: null, updatedAt: now() });
      t.create(
        rr.collection("events").doc(`${r.version + 1}-payment_captured`),
        {
          schemaVersion: 1,
          createdAt: now(),
          eventType: "payment_captured",
          actorId: "system",
          actorRole: "system",
          rideVersion: r.version + 1,
          requestId: randomUUID(),
        },
      );
    }
    if (er)
      t.set(er, {
        schemaVersion: 1,
        createdAt: now(),
        provider: "razorpay",
        ...event,
        status: "processed",
        processedAt: now(),
      });
    return {
      status:
        p.status === "review_required" && p.capturedPaymentId
          ? "review_required"
          : "paid",
    };
  });
}
export async function verify(a: Actor, body: unknown) {
  const b = z
      .object({
        rideId: z.string().max(128),
        orderId: z.string().max(128),
        paymentId: z.string().max(128),
        signature: z.string().length(64),
      })
      .strict()
      .parse(body),
    doc = await authorizeRide(a, b.rideId);
  ensure(
    doc.data()?.riderId === a.uid,
    404,
    "NOT_FOUND",
    "This payment is unavailable.",
  );
  const p = dto<Payment>(await admin().db.doc(`payments/${b.rideId}`).get());
  ensure(
    p.providerOrderId === b.orderId,
    422,
    "ORDER_MISMATCH",
    "The checkout does not match your ride.",
  );
  ensure(
    signature(`${b.orderId}|${b.paymentId}`, b.signature, credentials().secret),
    422,
    "INVALID_SIGNATURE",
    "Payment verification failed. Check its status.",
  );
  const capture = captureSchema.parse(
    await provider(`payments/${encodeURIComponent(b.paymentId)}`),
  );
  ensure(
    capture.id === b.paymentId &&
      capture.order_id === p.providerOrderId &&
      capture.amount === p.amountPaise,
    422,
    "PAYMENT_MISMATCH",
    "The provider payment does not match this ride.",
  );
  if (capture.status === "captured") return applyCapture(capture);
  const status =
    capture.status === "authorized"
      ? "processing"
      : capture.status === "failed"
        ? "failed"
        : "pending";
  return admin().db.runTransaction(async (t) => {
    const pr = admin().db.doc(`payments/${b.rideId}`),
      rr = admin().db.doc(`rides/${b.rideId}`),
      [pd, rd] = await t.getAll(pr, rr);
    if (pd.data()?.capturedPaymentId) return { status: pd.data()!.status };
    if (pd.data()?.status === "review_required")
      return { status: "review_required" };
    t.update(pr, { status, ...updated(pd.data()!.version) });
    t.update(rr, { paymentStatus: status, ...updated(rd.data()!.version) });
    return { status };
  });
}
export async function paymentStatus(a: Actor, id: string, reconcile = true) {
  const doc = await authorizeRide(a, id),
    pdoc = await admin().db.doc(`payments/${id}`).get();
  ensure(pdoc.exists, 404, "NOT_FOUND", "No payment is due for this ride.");
  const p = dto<Payment>(pdoc);
  if (
    reconcile &&
    !p.capturedPaymentId &&
    p.providerOrderId &&
    (a.uid === doc.data()?.riderId || a.admin)
  ) {
    const data = z
      .object({ items: z.array(captureSchema) })
      .parse(
        await provider(
          `orders/${encodeURIComponent(p.providerOrderId)}/payments`,
        ),
      );
    for (const item of data.items)
      if (item.status === "captured" && item.captured) await applyCapture(item);
  }
  return dto<Payment>(await pdoc.ref.get());
}
export async function webhook(
  raw: string,
  header: string | null,
  eventId: string | null,
) {
  ensure(
    process.env.RAZORPAY_WEBHOOK_SECRET &&
      header &&
      signature(raw, header, process.env.RAZORPAY_WEBHOOK_SECRET),
    401,
    "INVALID_SIGNATURE",
    "Webhook signature rejected.",
  );
  ensure(
    eventId && /^[a-zA-Z0-9_-]{1,128}$/.test(eventId),
    400,
    "INVALID_EVENT",
    "Webhook event identifier is required.",
  );
  const body = z
      .object({
        event: z.string().max(80),
        payload: z.object({
          payment: z.object({ entity: captureSchema }).optional(),
        }),
      })
      .parse(JSON.parse(raw)),
    capture = body.payload.payment?.entity;
  if (!capture || body.event !== "payment.captured") return { received: true };
  const mapping = await admin()
    .db.doc(`providerOrders/${capture.order_id}`)
    .get();
  // A merchant's test account can also send events for other applications.
  // Acknowledge those signed events without changing Safar financial records.
  if (!mapping.exists || mapping.data()?.mode !== "test")
    return { received: true, ignored: true };
  const confirmed = captureSchema.parse(
    await provider(`payments/${encodeURIComponent(capture.id)}`),
  );
  await applyCapture(confirmed, {
    id: eventId,
    payloadHash: hash(raw),
    eventType: body.event,
  });
  return { received: true };
}
export async function receipt(a: Actor, id: string) {
  await authorizeRide(a, id);
  const doc = await admin().db.doc(`receipts/${id}`).get();
  ensure(
    doc.exists,
    409,
    "PAYMENT_NOT_CAPTURED",
    "A receipt is available after payment is verified.",
  );
  const r = doc.data()!;
  const pdf = await PDFDocument.create(),
    p = pdf.addPage([595, 842]),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, " ");
  let y = 755;
  const line = (text: string, size = 12, strong = false) => {
    const parts = clean(text).match(/.{1,72}(?:\s|$)|.{1,72}/g) ?? [""];
    for (const part of parts) {
      p.drawText(part, {
        x: 54,
        y,
        size,
        font: strong ? bold : font,
        color: rgb(0.08, 0.13, 0.16),
      });
      y -= size + 12;
    }
  };
  line("safar", 36, true);
  line("TEST PAYMENT RECEIPT", 18, true);
  line("No real money collected. Not a tax invoice.");
  y -= 20;
  line(r.receiptNumber, 14, true);
  line(`Ride: ${id}`);
  line(
    `Issued: ${r.issuedAt.toDate().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
  );
  y -= 20;
  line(`Passenger: ${r.riderSnapshot.displayName}`);
  line(`Driver: ${r.driverSnapshot.displayName}`);
  line(
    `Vehicle: ${r.vehicleSnapshot.make} ${r.vehicleSnapshot.model} / ${r.vehicleSnapshot.plate}`,
  );
  y -= 20;
  line(`Pickup: ${r.pickupLabel}`);
  line(`Destination: ${r.destinationLabel}`);
  line(
    `Distance: ${(r.distanceMeters / 1000).toFixed(1)} km / Estimated time: ${Math.round(r.durationSeconds / 60)} min`,
  );
  y -= 20;
  line(`Captured test fare: INR ${(r.amountPaise / 100).toFixed(2)}`, 20, true);
  line(`Provider payment: ${r.providerPaymentId}`);
  line("Thank you for travelling with Safar.");
  return pdf.save();
}
