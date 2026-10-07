import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
const uid = process.argv[2];
if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
  throw new Error("Provide an existing onboarded Firebase UID.");
const app = initializeApp({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app),
  db = getFirestore(app),
  user = await auth.getUser(uid),
  ref = db.doc("users/" + uid);
await db.runTransaction(async (t) => {
  const d = await t.get(ref);
  if (!d.exists || d.data()?.accountStatus !== "active")
    throw new Error("Complete onboarding with an active account first.");
  const roles = d.data()!.roles;
  if (!roles.includes("admin"))
    t.update(ref, {
      roles: [...roles, "admin"],
      updatedAt: Timestamp.now(),
      version: d.data()!.version + 1,
    });
  t.create(db.collection("auditLogs").doc(), {
    schemaVersion: 1,
    createdAt: Timestamp.now(),
    actorId: "operator",
    action: "role_grant",
    resourceType: "user",
    resourceId: uid,
    afterState: "admin",
    requestId: randomUUID(),
    environment: process.env.APP_ENV ?? "preview",
  });
});
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
console.log(
  "Administrator capability granted and audited. Sign out and sign in to refresh claims.",
);
