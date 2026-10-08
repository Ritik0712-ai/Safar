import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { admin } from "@/lib/firebase/admin";
import { area } from "@/lib/domain";
import {
  actor,
  AppError,
  ensure,
  operation,
  rate,
  serialize,
  role,
} from "@/server/core";
import * as accounts from "@/server/services/accounts";
import * as quotes from "@/server/services/quotes";
import * as rides from "@/server/services/rides";
import * as drivers from "@/server/services/drivers";
import * as payments from "@/server/services/payments";
import * as support from "@/server/services/support";
import * as operations from "@/server/services/admin";
import * as geo from "@/server/providers/geoapify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function readBody(req: Request, limit: number) {
  ensure(
    Number(req.headers.get("content-length") ?? 0) <= limit,
    413,
    "BODY_TOO_LARGE",
    "This request is too large.",
  );
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new AppError(413, "BODY_TOO_LARGE", "This request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function handler(req: Request, ctx: Context) {
  const requestId = randomUUID();
  const json = (data: unknown, status = 200) =>
    NextResponse.json(
      { data: serialize(data), requestId },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const { path } = await ctx.params;
    ensure(
      path.every((p) => /^[a-zA-Z0-9_-]{1,128}$/.test(p)),
      400,
      "INVALID_PATH",
      "This request is unavailable.",
    );
    const url = new URL(req.url),
      p = path.join("/"),
      method = req.method,
      cookie = await cookies();
    const trustedOrigins = new Set(
      [
        process.env.APP_ORIGIN,
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : undefined,
        process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : undefined,
      ].filter(Boolean),
    );
    const sameOrigin = trustedOrigins.has(req.headers.get("origin") ?? "");
    const config = {
      serviceArea: area,
      rideType: "economy",
      capacity: 4,
      paymentMode: "test",
      demoMode:
        process.env.DEMO_MODE === "true" &&
        process.env.APP_ENV !== "production",
      environment: process.env.APP_ENV ?? "development",
      mapsReady: !!process.env.GEOAPIFY_SERVER_KEY,
      paymentsReady: !!process.env.RAZORPAY_KEY_SECRET,
      authReady: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    };
    if (p === "config" && method === "GET") return json(config);
    if (p === "health" && method === "GET") {
      const ready = !!(
        config.authReady &&
        process.env.FIREBASE_ADMIN_PROJECT_ID &&
        config.mapsReady &&
        config.paymentsReady &&
        process.env.TRIP_PIN_ENCRYPTION_KEY
      );
      return json({ status: ready ? "ready" : "degraded" }, ready ? 200 : 503);
    }
    if (p === "session" && method === "GET") {
      const csrf = randomUUID();
      cookie.set("safar_csrf", csrf, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 600,
      });
      return json({ csrf });
    }
    if (p === "session" && method === "DELETE") {
      ensure(
        sameOrigin &&
          req.headers.get("x-csrf-token") === cookie.get("safar_csrf")?.value,
        403,
        "INVALID_ORIGIN",
        "Refresh and try again.",
      );
      cookie.delete("safar_session");
      return json({ signedOut: true });
    }
    const raw =
      method === "GET"
        ? ""
        : await readBody(req, p === "webhooks/razorpay" ? 262144 : 16384);
    ensure(
      Buffer.byteLength(raw) <= (p === "webhooks/razorpay" ? 262144 : 16384),
      413,
      "BODY_TOO_LARGE",
      "This request is too large.",
    );
    if (p === "webhooks/razorpay" && method === "POST")
      return json(
        await payments.webhook(
          raw,
          req.headers.get("x-razorpay-signature"),
          req.headers.get("x-razorpay-event-id"),
        ),
      );
    if (method !== "GET")
      ensure(
        sameOrigin ||
          (!req.headers.has("origin") && process.env.APP_ENV === "test"),
        403,
        "INVALID_ORIGIN",
        "Refresh and try again.",
      );
    const a = await actor(req);
    const body = raw ? JSON.parse(raw) : {};
    const op = (name = p) => operation(req, a, name, body),
      cursor = url.searchParams.get("cursor"),
      status = url.searchParams.get("status");
    if (p === "session" && method === "POST") {
      ensure(
        req.headers.get("x-csrf-token") === cookie.get("safar_csrf")?.value,
        403,
        "CSRF_REJECTED",
        "Refresh and sign in again.",
      );
      ensure(
        Date.now() / 1000 - a.authTime < 300,
        401,
        "RECENT_LOGIN_REQUIRED",
        "Sign in again to refresh your session.",
      );
      const token = req.headers.get("authorization")!.replace("Bearer ", ""),
        session = await admin().auth.createSessionCookie(token, {
          expiresIn: 5 * 86400000,
        });
      cookie.set("safar_session", session, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 5 * 86400,
      });
      return json({ signedIn: true });
    }
    if (p === "me" && method === "GET") return json(await accounts.me(a));
    if (p === "me/verification-email" && method === "POST") {
      await rate(a.uid, "verification_email", 1);
      const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      ensure(
        key,
        503,
        "CONFIGURATION_UNAVAILABLE",
        "Email verification is being configured.",
      );
      const prefix =
        process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.VERCEL
          ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/`
          : "https://identitytoolkit.googleapis.com/v1/";
      const response = await fetch(
        `${prefix}accounts:sendOobCode?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "VERIFY_EMAIL",
            idToken: req.headers.get("authorization")!.replace(/^Bearer /, ""),
            continueUrl: `${process.env.APP_ORIGIN}/sign-in`,
            canHandleCodeInApp: false,
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      ensure(
        response.ok,
        502,
        "VERIFICATION_EMAIL_UNAVAILABLE",
        "The verification link could not be sent. Please try again later.",
      );
      return json({ sent: true });
    }
    if (p === "me/onboarding" && method === "POST")
      return json(await accounts.onboard(op()));
    if (p === "me" && method === "PATCH")
      return json(await accounts.profile(a, body));
    if (p === "drivers/me" && method === "GET")
      return json(await accounts.driver(a));
    if (p === "drivers/application" && method === "POST")
      return json(await accounts.application(op()));
    if (p === "drivers/me/heartbeat" && method === "POST")
      return json(await drivers.heartbeat(a, body));
    if (p === "drivers/me/availability" && method === "POST")
      return json(await drivers.availability(a, body));
    if (p === "drivers/me/offers" && method === "GET")
      return json(await rides.offers(a));
    if (p === "drivers/me/earnings" && method === "GET")
      return json(
        await operations.earnings(
          a,
          url.searchParams.get("range") ?? "all",
          cursor,
        ),
      );
    if (p === "places/search" && method === "GET") {
      await rate(a.uid, "search", 30);
      return json(await geo.search(url.searchParams.get("q") ?? ""));
    }
    if (p === "places/reverse" && method === "GET") {
      await rate(a.uid, "search", 30);
      const lat = z.coerce
          .number()
          .min(-90)
          .max(90)
          .parse(url.searchParams.get("lat")),
        lng = z.coerce
          .number()
          .min(-180)
          .max(180)
          .parse(url.searchParams.get("lng"));
      return json(await geo.reverse(lat, lng));
    }
    if (p === "quotes" && method === "POST") {
      await rate(a.uid, "quote", 10);
      return json(await quotes.createQuote(a, body));
    }
    if (path[0] === "quotes" && path.length === 2 && method === "GET")
      return json(await quotes.getQuote(a, path[1]));
    if (p === "rides" && method === "POST") {
      await rate(a.uid, "booking", 3);
      return json(await rides.book(op()));
    }
    if (p === "rides" && method === "GET")
      return json(
        await rides.history(
          a,
          url.searchParams.get("role") ?? "rider",
          status,
          cursor,
        ),
      );
    if (path[0] === "rides" && path.length >= 2) {
      const id = path[1],
        action = path[2];
      if (path.length === 2 && method === "GET")
        return json(await rides.readRide(a, id));
      if (action === "refresh" && method === "POST") {
        await rides.authorizeRide(a, id);
        await rides.dispatch(id);
        return json(await rides.readRide(a, id));
      }
      if (action === "pin" && method === "GET")
        return json(await rides.pin(a, id));
      if (action === "payment-status" && method === "GET") {
        await rate(a.uid, "payment_status", 6);
        return json(await payments.paymentStatus(a, id));
      }
      if (action === "receipt" && method === "GET") {
        const pdf = await payments.receipt(a, id);
        return new Response(Buffer.from(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="safar-TEST-${id}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (action === "accept" && method === "POST")
        return json(await rides.accept(op(), id));
      if (action === "decline" && method === "POST")
        return json(await rides.decline(op(), id));
      if (
        ["arrive", "start", "complete", "cancel"].includes(action) &&
        method === "POST"
      ) {
        if (action === "start") await rate(`${a.uid}:${id}`, "pin", 5);
        return json(await rides.transition(op(), id, action));
      }
      if (action === "review" && method === "POST")
        return json(await rides.review(op(), id));
      if (action === "payment-order" && method === "POST") {
        await rate(a.uid, "payment_order", 6);
        return json(await payments.order(op(), id));
      }
    }
    if (p === "payments/verify" && method === "POST")
      return json(await payments.verify(a, body));
    if (p === "support/tickets" && method === "GET")
      return json(await support.listTickets(a, status, cursor));
    if (p === "support/tickets" && method === "POST") {
      await rate(a.uid, "support", 5);
      return json(await support.createTicket(op()));
    }
    if (path[0] === "support" && path[1] === "tickets" && path[2]) {
      if (path.length === 3 && method === "GET")
        return json(await support.getTicket(a, path[2], cursor));
      if (path[3] === "messages" && method === "POST") {
        await rate(a.uid, "support", 5);
        return json(await support.message(op(), path[2]));
      }
      if (path[3] === "status" && method === "POST")
        return json(await support.ticketStatus(op(), path[2]));
    }
    if (path[0] === "admin") {
      role(a, "admin");
      if (p === "admin/overview" && method === "GET")
        return json(await operations.overview(a));
      if (p === "admin/drivers" && method === "GET")
        return json(
          await operations.drivers(
            a,
            status ?? "pending",
            cursor,
            url.searchParams.get("exact"),
          ),
        );
      if (path[1] === "drivers" && path[2]) {
        if (path.length === 3 && method === "GET")
          return json(await operations.inspectDriver(a, path[2]));
        if (path[3] === "decision" && method === "POST")
          return json(await accounts.decision(op(), path[2]));
      }
      if (p === "admin/rides" && method === "GET")
        return json(
          await operations.adminRides(
            a,
            status,
            cursor,
            url.searchParams.get("exact"),
          ),
        );
      if (path[1] === "rides" && path[3] === "reconcile" && method === "POST")
        return json(await payments.paymentStatus(a, path[2]));
      if (p === "admin/support" && method === "GET")
        return json(await support.listTickets(a, status, cursor, true));
      if (p === "admin/demo/reset" && method === "POST")
        return json(await operations.resetDemo(op()));
    }
    throw new AppError(404, "NOT_FOUND", "This endpoint is unavailable.");
  } catch (e) {
    if (e instanceof SyntaxError)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "This request contains invalid data.",
            retryable: false,
          },
          requestId,
        },
        { status: 400 },
      );
    if (e instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Check the highlighted fields.",
            fieldErrors: e.flatten().fieldErrors,
            retryable: false,
          },
          requestId,
        },
        { status: 400 },
      );
    if (e instanceof AppError)
      return NextResponse.json(
        {
          error: { code: e.code, message: e.message, retryable: e.retryable },
          requestId,
        },
        { status: e.status },
      );
    const config =
      e instanceof Error &&
      (e.message === "CONFIGURATION_UNAVAILABLE" ||
        e.message.includes("credential"));
    return NextResponse.json(
      {
        error: {
          code: config ? "CONFIGURATION_UNAVAILABLE" : "REQUEST_FAILED",
          message: config
            ? "Safar is being connected to its services. Please try again shortly."
            : "This request could not be completed. Refresh and try again.",
          retryable: true,
        },
        requestId,
      },
      { status: config ? 503 : 500 },
    );
  }
}
export const GET = handler,
  POST = handler,
  PATCH = handler,
  DELETE = handler;
