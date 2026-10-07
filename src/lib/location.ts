"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, onDisconnect, update } from "firebase/database";
import { api, useAuth } from "@/components/auth-provider";
import { firebase } from "./firebase/client";
import type { Location } from "@/contracts";
export function useTracking(rideId: string | null) {
  const [location, setLocation] = useState<Location | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const f = firebase();
    if (!f || !rideId) return;
    setLocation(null);
    return onValue(
      ref(f.rtdb, `rideTracking/${rideId}`),
      (s) => {
        setLocation(s.exists() ? s.val() : null);
        setError("");
      },
      () => setError("Tracking is connecting. Refresh to try again."),
    );
  }, [rideId]);
  return { location, error };
}
export function useLocationController() {
  const auth = useAuth(),
    [location, setLocation] = useState<Location | null>(null),
    [error, setError] = useState(""),
    [simulation, setSimulation] = useState(false);
  const session = useRef<string>(""),
    activeRide = useRef(auth.driver?.activeRideId),
    sequence = useRef(0),
    watch = useRef<number | null>(null),
    lastSent = useRef(0),
    lastGrant = useRef(0),
    simTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    latest = useRef<Location | null>(null),
    [tracking, setTracking] = useState(false);
  const send = useCallback(
    async (
      lat: number,
      lng: number,
      accuracy: number,
      source: "gps" | "simulation",
    ) => {
      if (!session.current) session.current = crypto.randomUUID();
      const value = {
        lat,
        lng,
        accuracy,
        source,
        timestamp: Date.now(),
        sequence: ++sequence.current,
        sessionId: session.current,
      };
      const f = firebase();
      if (Date.now() - lastGrant.current >= 55000 || !f || !auth.user) {
        await api("drivers/me/heartbeat", value);
        lastGrant.current = Date.now();
      } else {
        const changes: Record<string, unknown> = {
          [`driverLocations/${auth.user.uid}`]: value,
          [`driverPresence/${auth.user.uid}`]: {
            online: true,
            timestamp: value.timestamp,
            sessionId: value.sessionId,
          },
        };
        if (activeRide.current)
          changes[`rideTracking/${activeRide.current}`] = {
            ...value,
            driverId: auth.user.uid,
          };
        await update(ref(f.rtdb), changes);
      }
      latest.current = value;
      setLocation(value);
      lastSent.current = Date.now();
      setError("");
      if (f && auth.user)
        onDisconnect(ref(f.rtdb, `driverPresence/${auth.user.uid}`))
          .update({
            online: false,
            timestamp: Date.now(),
            sessionId: session.current,
          })
          .catch(() => {});
      return value;
    },
    [auth.user],
  );
  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (simTimer.current) clearInterval(simTimer.current);
    watch.current = null;
    simTimer.current = null;
    setTracking(false);
  }, []);
  async function start(sim = false) {
    stop();
    setError("");
    setSimulation(sim);
    session.current = crypto.randomUUID();
    sequence.current = 0;
    lastGrant.current = 0;
    if (sim) {
      await send(12.9716, 77.5946, 5, "simulation");
      setTracking(true);
      simTimer.current = setInterval(() => {
        if (
          document.visibilityState === "visible" &&
          navigator.onLine &&
          latest.current
        )
          send(latest.current.lat, latest.current.lng, 5, "simulation").catch(
            (e) => setError(e.message),
          );
      }, 5000);
      return;
    }
    if (!navigator.geolocation)
      throw new Error("This browser does not support location.");
    await new Promise<void>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => {
          send(p.coords.latitude, p.coords.longitude, p.coords.accuracy, "gps")
            .then(() => resolve())
            .catch(reject);
        },
        () =>
          reject(
            new Error(
              "Allow location access in your browser settings to drive.",
            ),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      ),
    );
    setTracking(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (
          Date.now() - lastSent.current >= 5000 &&
          document.visibilityState === "visible"
        )
          send(
            p.coords.latitude,
            p.coords.longitude,
            p.coords.accuracy,
            "gps",
          ).catch((e) => setError(e.message));
      },
      () => setError("Location is unavailable. Refresh your GPS."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    simTimer.current = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() - lastSent.current >= 5000
      )
        navigator.geolocation.getCurrentPosition(
          (p) => {
            void send(
              p.coords.latitude,
              p.coords.longitude,
              p.coords.accuracy,
              "gps",
            ).catch((e) => setError(e.message));
          },
          () => setError("Get a fresh location to continue tracking."),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
        );
    }, 5000);
  }
  function move(lat: number, lng: number) {
    if (simulation && tracking)
      void send(lat, lng, 5, "simulation").catch((e) => setError(e.message));
  }
  useEffect(
    () => () => {
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      if (simTimer.current) clearInterval(simTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!auth.user) {
      stop();
      setLocation(null);
    }
  }, [auth.user, stop]);
  useEffect(() => {
    activeRide.current = auth.driver?.activeRideId;
  }, [auth.driver?.activeRideId]);
  return { location, error, simulation, tracking, start, stop, move, setError };
}
