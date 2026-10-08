"use client";
import { useEffect } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  limit,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";
export function useRideUpdates(id: string, refresh: () => Promise<void>) {
  const { user } = useAuth();
  useEffect(() => {
    const f = firebase();
    if (!f || !user) return;
    return onSnapshot(
      doc(f.db, "rides", id),
      () => {
        void refresh();
      },
      () => {
        /* Authorized polling continues during reconnection. */
      },
    );
  }, [id, user, refresh]);
}
export function useOfferUpdates(refresh: () => Promise<void>) {
  const { user } = useAuth();
  useEffect(() => {
    const f = firebase();
    if (!f || !user) return;
    const scoped = query(
      collection(f.db, "drivers", user.uid, "offers"),
      where("status", "==", "open"),
      limit(10),
    );
    return onSnapshot(
      scoped,
      () => {
        void refresh();
      },
      () => {
        /* Bounded polling remains the recovery path. */
      },
    );
  }, [user, refresh]);
}
