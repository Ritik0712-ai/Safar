import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { ref, get, set } from "firebase/database";
let env: RulesTestEnvironment;
describe("Firestore and RTDB default-deny permission matrix", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-safar",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync("firebase/firestore.rules", "utf8"),
      },
      database: {
        host: "127.0.0.1",
        port: 9000,
        rules: readFileSync("firebase/database.rules.json", "utf8"),
      },
    });
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "users/rules-rider"), {
        uid: "rules-rider",
        accountStatus: "active",
      });
      await setDoc(doc(db, "users/rules-driver"), {
        uid: "rules-driver",
        accountStatus: "active",
      });
      await setDoc(doc(db, "users/rules-other"), {
        uid: "rules-other",
        accountStatus: "active",
      });
      await setDoc(doc(db, "users/rules-suspended"), {
        uid: "rules-suspended",
        accountStatus: "suspended",
      });
      await setDoc(doc(db, "drivers/rules-driver"), { uid: "rules-driver" });
      await setDoc(doc(db, "rides/rules-trip"), {
        riderId: "rules-rider",
        driverId: "rules-driver",
        status: "assigned",
      });
      await setDoc(doc(db, "rides/rules-trip/events/1-requested"), {
        eventType: "requested",
      });
      await setDoc(doc(db, "rideSecrets/rules-trip"), {
        pinCiphertext: "encrypted",
      });
      await setDoc(doc(db, "rides/orphan/events/1"), {
        eventType: "requested",
      });
      const session = "11111111-1111-4111-a111-111111111111";
      await set(ref(c.database(), "driverAccess/rules-driver"), {
        approved: true,
        simulationAllowed: false,
        sessionId: session,
        expiresAt: Date.now() + 90000,
      });
      await set(ref(c.database(), "rideAccess/rules-trip"), {
        riderId: "rules-rider",
        driverId: "rules-driver",
        trackingEnabled: true,
        version: 1,
        expiresAt: Date.now() + 75000,
      });
      await set(ref(c.database(), "rideTracking/rules-trip"), {
        lat: 12.97,
        lng: 77.59,
        accuracy: 5,
        source: "gps",
        timestamp: Date.now(),
        sequence: 1,
        sessionId: session,
        driverId: "rules-driver",
      });
    });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  it("permits only own/participant reads and correctly scoped queries", async () => {
    const rider = env.authenticatedContext("rules-rider").firestore(),
      other = env.authenticatedContext("rules-other").firestore(),
      anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(rider, "users/rules-rider")));
    await assertSucceeds(getDoc(doc(rider, "rides/rules-trip")));
    await assertSucceeds(
      getDocs(
        query(
          collection(rider, "rides"),
          where("riderId", "==", "rules-rider"),
        ),
      ),
    );
    await assertFails(getDoc(doc(other, "rides/rules-trip")));
    await assertFails(getDoc(doc(other, "users/rules-rider")));
    await assertFails(getDocs(collection(anon, "rides")));
    await assertFails(getDocs(collection(rider, "rides")));
    await assertFails(getDoc(doc(rider, "rideSecrets/rules-trip")));
    await assertFails(getDoc(doc(rider, "rides/orphan/events/1")));
  });
  it("rejects role grants, ownership changes, type pollution, transitions and every direct durable write", async () => {
    const c = env.authenticatedContext("rules-rider").firestore();
    for (const payload of [
      { roles: ["admin"] },
      { riderId: "rules-other" },
      { createdAt: "yesterday" },
      { status: "completed" },
      { extraData: "polluted" },
      { amount: -1 },
      { displayName: "x".repeat(10000) },
    ])
      await assertFails(updateDoc(doc(c, "rides/rules-trip"), payload));
    await assertFails(
      setDoc(doc(c, "users/new-user"), {
        uid: "rules-other",
        roles: ["admin"],
      }),
    );
    await assertFails(deleteDoc(doc(c, "rides/rules-trip")));
    await assertFails(
      setDoc(doc(c, "reviews/fake"), { stars: 5, driverId: "rules-driver" }),
    );
  });
  it("blocks suspended-account reads and orphaned subcollections", async () => {
    const c = env.authenticatedContext("rules-suspended").firestore();
    await assertFails(getDoc(doc(c, "rides/rules-trip")));
    await assertFails(getDoc(doc(c, "drivers/rules-driver/offers/missing")));
  });
  it("enforces live participant leases, session sequencing, typed coordinates and simulation allowlisting", async () => {
    const rider = env.authenticatedContext("rules-rider").database(),
      driver = env.authenticatedContext("rules-driver").database(),
      other = env.authenticatedContext("rules-other").database();
    await assertSucceeds(get(ref(rider, "rideTracking/rules-trip")));
    await assertFails(get(ref(other, "rideTracking/rules-trip")));
    await assertFails(get(ref(rider, "driverLocations/rules-driver")));
    const valid = {
      lat: 12.97,
      lng: 77.59,
      accuracy: 5,
      source: "gps",
      timestamp: Date.now(),
      sequence: 2,
      sessionId: "11111111-1111-4111-a111-111111111111",
      driverId: "rules-driver",
    };
    await assertSucceeds(set(ref(driver, "rideTracking/rules-trip"), valid));
    for (const data of [
      { ...valid, sequence: 1 },
      { ...valid, lat: "bad" },
      { ...valid, lat: 100 },
      { ...valid, source: "simulation" },
      { ...valid, timestamp: Date.now() - 30000 },
      { ...valid, timestamp: Date.now() + 30000 },
      { ...valid, sessionId: "22222222-2222-4222-a222-222222222222" },
      { ...valid, extra: "pollution" },
      { ...valid, driverId: "rules-other" },
    ])
      await assertFails(set(ref(driver, "rideTracking/rules-trip"), data));
    await assertFails(set(ref(rider, "rideTracking/rules-trip"), valid));
    await assertFails(
      set(ref(driver, "rideAccess/rules-trip"), { trackingEnabled: true }),
    );
    await env.withSecurityRulesDisabled(async (c) =>
      set(
        ref(c.database(), "rideAccess/rules-trip/expiresAt"),
        Date.now() - 1000,
      ),
    );
    await assertFails(get(ref(rider, "rideTracking/rules-trip")));
    await assertFails(
      set(ref(driver, "rideTracking/rules-trip"), { ...valid, sequence: 3 }),
    );
  });
});
