import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID,
  emulator = !!process.env.FIRESTORE_EMULATOR_HOST,
  apply = process.argv.includes("--apply");
if (!projectId)
  throw new Error("Load an explicit project configuration first.");
if (apply && (!emulator || !projectId.startsWith("demo-")))
  throw new Error(
    "Apply is restricted to the named demo emulator. Live cleanup requires a separate reviewed operator action.",
  );
const app = initializeApp({
    projectId,
    ...(!emulator
      ? {
          credential: cert({
            projectId,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
              /\\n/g,
              "\n",
            ),
          }),
        }
      : {}),
  }),
  db = getFirestore(app);
const cutoff = (days: number) =>
  Timestamp.fromMillis(Date.now() - days * 86400000);
const rows = [
  {
    collection: "quotes",
    field: "expiresAt",
    before: cutoff(1),
    eligible: (d: Record<string, unknown>) => d.consumedByRideId === null,
  },
  {
    collection: "operations",
    field: "expiresAt",
    before: cutoff(0),
    eligible: (d: Record<string, unknown>) => d.status === "committed",
  },
  {
    collection: "rateLimits",
    field: "expiresAt",
    before: cutoff(2),
    eligible: () => true,
  },
  {
    collection: "webhookEvents",
    field: "createdAt",
    before: cutoff(30),
    eligible: (d: Record<string, unknown>) =>
      ["processed", "ignored"].includes(String(d.status)),
  },
];
for (const rule of rows) {
  const snapshot = await db
    .collection(rule.collection)
    .where(rule.field, "<", rule.before)
    .orderBy(rule.field)
    .limit(100)
    .get();
  const eligible = snapshot.docs.filter((d) => rule.eligible(d.data()));
  console.log(rule.collection, {
    scanned: snapshot.size,
    eligible: eligible.length,
    mode: apply ? "emulator apply" : "dry run",
    bounded: true,
  });
  if (apply && eligible.length) {
    const batch = db.batch();
    eligible.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
console.log(
  "Financial records, audit, rides, user identities, support and uncertain operations are preserved. Results cover at most 100 records per collection; they are not global totals.",
);
