"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useLocationController } from "@/lib/location";
const Context = createContext<ReturnType<typeof useLocationController> | null>(
  null,
);
export function DriverLocationProvider({ children }: { children: ReactNode }) {
  const controller = useLocationController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useDriverLocation() {
  const value = useContext(Context);
  if (!value) throw new Error("Location provider is unavailable.");
  return value;
}
