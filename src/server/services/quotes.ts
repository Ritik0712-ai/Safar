import "server-only";
import { z } from "zod";
import { admin } from "@/lib/firebase/admin";
import { placeSchema, type Quote } from "@/contracts";
import { fare } from "@/lib/domain";
import { route } from "@/server/providers/geoapify";
import { base, future, role, dto, ensure, type Actor } from "@/server/core";
export async function createQuote(a: Actor, body: unknown) {
  role(a, "rider", true);
  const b = z
      .object({ pickup: placeSchema, destination: placeSchema })
      .strict()
      .parse(body),
    r = await route(b.pickup, b.destination);
  const ref = admin().db.collection("quotes").doc();
  await ref.create({
    ...base(),
    riderId: a.uid,
    serviceAreaId: "bengaluru-demo",
    rideType: "economy",
    ...b,
    distanceMeters: r.distanceMeters,
    durationSeconds: r.durationSeconds,
    routeGeometryJson: JSON.stringify(r.routeGeometry),
    fare: fare(r.distanceMeters, r.durationSeconds),
    provider: "geoapify",
    expiresAt: future(300000),
    consumedByRideId: null,
    isDemo: a.account!.isDemo,
  });
  return getQuote(a, ref.id);
}
export async function getQuote(a: Actor, id: string) {
  const doc = await admin().db.doc(`quotes/${id}`).get();
  ensure(
    doc.exists && doc.data()?.riderId === a.uid,
    404,
    "NOT_FOUND",
    "This quote is unavailable.",
  );
  const stored = dto<Quote & { routeGeometryJson: string }>(doc);
  const { routeGeometryJson, ...safe } = stored;
  return {
    ...safe,
    routeGeometry: JSON.parse(routeGeometryJson) as Quote["routeGeometry"],
    quoteId: id,
  };
}
