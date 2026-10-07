import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !projectId?.startsWith("demo-")
)
  throw new Error(
    "This seed runs only against a demo Firebase emulator project.",
  );
const app = initializeApp({
    projectId,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  }),
  auth = getAuth(app),
  db = getFirestore(app);
const path = ".env.demo-accounts.json";
const accounts = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : [
      {
        uid: "demo-rider",
        name: "Aarav Mehta",
        role: "rider",
        email: "rider@safar.test",
        password: randomBytes(16).toString("hex"),
      },
      {
        uid: "demo-driver",
        name: "Kabir Shah",
        role: "driver",
        email: "driver@safar.test",
        password: randomBytes(16).toString("hex"),
      },
      {
        uid: "demo-admin",
        name: "Safar Operator",
        role: "admin",
        email: "admin@safar.test",
        password: randomBytes(16).toString("hex"),
      },
    ];
for (const a of accounts) {
  try {
    await auth.getUser(a.uid);
  } catch {
    await auth.createUser({
      uid: a.uid,
      email: a.email,
      password: a.password,
      emailVerified: true,
      displayName: a.name,
    });
  }
  if (a.role === "admin")
    await auth.setCustomUserClaims(a.uid, { admin: true });
  const ref = db.doc("users/" + a.uid);
  if (!(await ref.get()).exists)
    await ref.create({
      schemaVersion: 1,
      version: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      uid: a.uid,
      displayName: a.name,
      phone: "+919876543210",
      email: a.email,
      roles:
        a.role === "driver"
          ? ["rider", "driver"]
          : a.role === "admin"
            ? ["rider", "admin"]
            : ["rider"],
      defaultWorkspace: a.role,
      emailVerified: true,
      onboardingComplete: true,
      accountStatus: "active",
      activeRideId: null,
      termsVersion: "demo-v1",
      termsAcceptedAt: Timestamp.now(),
      isDemo: true,
    });
  if (a.role === "driver" && !(await db.doc("drivers/" + a.uid).get()).exists) {
    await db
      .doc("drivers/" + a.uid)
      .create({
        schemaVersion: 1,
        version: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        uid: a.uid,
        approvalStatus: "approved",
        applicationVersion: 1,
        activeVehicleId: "demo-vehicle",
        activeRideId: null,
        availability: "offline",
        serviceAreaId: "bengaluru-demo",
        ratingSum: 0,
        ratingCount: 0,
        isDemo: true,
        accessSyncVersion: 1,
        accessSyncPending: false,
      });
    await db
      .doc("vehicles/demo-vehicle")
      .set({
        schemaVersion: 1,
        version: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        driverId: a.uid,
        plate: "KA 01 AB 1234",
        normalizedPlate: "KA01AB1234",
        make: "Maruti Suzuki",
        model: "Dzire",
        color: "White",
        seats: 4,
        rideType: "economy",
        approvalStatus: "approved",
        applicationVersion: 1,
        isDemo: true,
      });
  }
}
writeFileSync(path, JSON.stringify(accounts, null, 2) + "\n", { mode: 0o600 });
console.log(
  "Three local demo identities seeded. Credentials saved privately in .env.demo-accounts.json.",
);
