import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
const env = loadEnv("test", process.cwd(), "");
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    env: {
      ...env,
      APP_ENV: "test",
      TEST_PROVIDER_FIXTURES: "true",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000",
      FIREBASE_ADMIN_PROJECT_ID: "demo-safar",
      NEXT_PUBLIC_FIREBASE_DATABASE_URL:
        "http://127.0.0.1:9000/?ns=demo-safar-default-rtdb",
      DEMO_MODE: "true",
      RAZORPAY_KEY_ID: "rzp_test_fixture",
      RAZORPAY_KEY_SECRET: "fixture-secret",
      RAZORPAY_WEBHOOK_SECRET: "fixture-webhook",
      TRIP_PIN_ENCRYPTION_KEY: "1".repeat(64),
      TRIP_PIN_HMAC_KEY: "2".repeat(64),
      CURSOR_SIGNING_KEY: "3".repeat(64),
    },
    testTimeout: 360000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
