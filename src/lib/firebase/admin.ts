import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
export function admin() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) throw new Error("CONFIGURATION_UNAVAILABLE");
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && (process.env.VERCEL || !projectId.startsWith("demo-")))
    throw new Error("UNSAFE_EMULATOR_CONFIGURATION");
  const app =
    getApps()[0] ??
    initializeApp({
      projectId,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
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
    });
  return { auth: getAuth(app), db: getFirestore(app), rtdb: getDatabase(app) };
}
