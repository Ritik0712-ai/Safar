import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
const local = parseEnv(readFileSync(".env.local", "utf8"));
if (
  !local.FIREBASE_ADMIN_PROJECT_ID?.startsWith("demo-") ||
  !local.FIRESTORE_EMULATOR_HOST
)
  throw new Error(
    "E2E fixtures require the local demo emulator configuration.",
  );
Object.assign(process.env, local);
const caseId = randomUUID().slice(0, 8),
  app = initializeApp({ projectId: local.FIREBASE_ADMIN_PROJECT_ID }),
  db = getFirestore(app),
  auth = getAuth(app),
  stamp = Timestamp.now();
const accounts = [
  {
    uid: `e2e-rider-${caseId}`,
    role: "rider",
    email: `rider-${caseId}@safar.test`,
    password: randomUUID() + randomUUID(),
    name: "Test Passenger",
  },
  {
    uid: `e2e-driver-${caseId}`,
    role: "driver",
    email: `driver-${caseId}@safar.test`,
    password: randomUUID() + randomUUID(),
    name: "Test Driver",
  },
];
for (const a of accounts) {
  await auth.createUser({
    uid: a.uid,
    email: a.email,
    password: a.password,
    emailVerified: true,
    displayName: a.name,
  });
  await db
    .doc(`users/${a.uid}`)
    .create({
      schemaVersion: 1,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      uid: a.uid,
      displayName: a.name,
      phone: "+919876543210",
      email: a.email,
      emailVerified: true,
      roles: a.role === "driver" ? ["rider", "driver"] : ["rider"],
      defaultWorkspace: a.role,
      accountStatus: "active",
      onboardingComplete: true,
      activeRideId: null,
      termsVersion: "demo-v1",
      termsAcceptedAt: stamp,
      isDemo: true,
    });
  if (a.role === "driver") {
    await db
      .doc(`drivers/${a.uid}`)
      .create({
        schemaVersion: 1,
        version: 1,
        createdAt: stamp,
        updatedAt: stamp,
        uid: a.uid,
        approvalStatus: "approved",
        applicationVersion: 1,
        activeVehicleId: a.uid + "-vehicle",
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
      .doc(`vehicles/${a.uid}-vehicle`)
      .create({
        schemaVersion: 1,
        version: 1,
        createdAt: stamp,
        updatedAt: stamp,
        driverId: a.uid,
        plate: "KA01TT" + String(Math.floor(Math.random() * 9000) + 1000),
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
writeFileSync(".env.e2e-accounts.json", JSON.stringify(accounts), {
  mode: 0o600,
});
const orders = new Map(),
  captures = new Map();
let lastOrder;
const fixture = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4111");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/last-order") {
    res.end(JSON.stringify(lastOrder));
    return;
  }
  if (url.pathname === "/v1/orders" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const b = JSON.parse(raw),
      order = {
        id: "order_fixture_" + randomUUID().replaceAll("-", ""),
        amount: b.amount,
        currency: "INR",
      };
    orders.set(order.id, order);
    lastOrder = order;
    res.end(JSON.stringify(order));
    return;
  }
  if (url.pathname.startsWith("/v1/payments/")) {
    const id = url.pathname.split("/").at(-1),
      orderId = id.replace(/^pay_fixture_/, ""),
      order = orders.get(orderId);
    if (!order) {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    const payment = {
      id,
      order_id: orderId,
      amount: order.amount,
      currency: "INR",
      status: "captured",
      captured: true,
    };
    captures.set(orderId, payment);
    res.end(JSON.stringify(payment));
    return;
  }
  if (/^\/v1\/orders\/[^/]+\/payments$/.test(url.pathname)) {
    const id = url.pathname.split("/")[3];
    res.end(
      JSON.stringify({ items: captures.has(id) ? [captures.get(id)] : [] }),
    );
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
await new Promise((resolve) => fixture.listen(4111, "127.0.0.1", resolve));
const env = {
  ...process.env,
  ...local,
  APP_ENV: "test",
  APP_ORIGIN: "http://localhost:3001",
  TEST_PROVIDER_FIXTURES: "true",
  TEST_PAYMENT_PROVIDER_URL: "http://127.0.0.1:4111/v1/",
  RAZORPAY_KEY_ID: "rzp_test_fixture",
  RAZORPAY_KEY_SECRET: "fixture-secret",
  RAZORPAY_WEBHOOK_SECRET: "fixture-webhook",
  DEMO_DRIVER_UIDS: accounts[1].uid,
};
const server = spawn("npm", ["run", "dev", "--", "--port", "3001"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.resume();
server.stderr.resume();
let code = 1;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch("http://localhost:3001/api/config");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!ready) throw new Error("Test server did not become ready.");
  code = await new Promise((resolve, reject) => {
    const tests = spawn(
      "npx",
      ["playwright", "test", "tests/e2e/journey.spec.ts"],
      {
        env: {
          ...process.env,
          E2E_BASE_URL: "http://localhost:3001",
          E2E_PROVIDER_FIXTURES: "true",
        },
        stdio: "inherit",
      },
    );
    tests.on("error", reject);
    tests.on("close", resolve);
  });
} finally {
  server.kill("SIGTERM");
  fixture.close();
}
process.exit(code ?? 1);
