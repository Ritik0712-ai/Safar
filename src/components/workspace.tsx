"use client";
import { useSearchParams } from "next/navigation";
import { Booking, QuoteReview } from "@/features/booking";
import { Trip } from "@/features/trip";
import { History } from "@/features/history";
import { Profile } from "@/features/profile";
import {
  DriverDashboard,
  DriverApplication,
  ApplicationStatus,
  Earnings,
} from "@/features/driver";
import { PaymentScreen, Rating } from "@/features/payment";
import { Help, NewTicket, Tickets, TicketThread } from "@/features/support";
import {
  AdminOverview,
  DriverQueue,
  DriverReview,
  AdminRides,
  RideInspection,
  DemoTools,
} from "@/features/admin";
import type { Role } from "@/contracts";
export function Workspace({ segments }: { segments: string[] }) {
  const [role, screen, id, action] = segments,
    workspace = role as Role,
    params = useSearchParams();
  if (role === "rider" && !screen) return <Booking />;
  if (role === "driver" && !screen) return <DriverDashboard />;
  if (role === "admin" && !screen) return <AdminOverview />;
  if (screen === "review") return <QuoteReview />;
  if (screen === "history") return <History workspace={workspace} />;
  if (screen === "profile") return <Profile workspace={workspace} />;
  if (screen === "earnings") return <Earnings />;
  if (screen === "application")
    return id === "status" ? <ApplicationStatus /> : <DriverApplication />;
  if (screen === "rides" && id) {
    if (role === "admin") return <RideInspection id={id} />;
    if (action === "payment") return <PaymentScreen id={id} />;
    if (action === "receipt") return <PaymentScreen id={id} receipt />;
    if (action === "rate") return <Rating id={id} />;
    return <Trip id={id} workspace={workspace} />;
  }
  if (role === "admin" && screen === "rides")
    return <AdminRides initial={params.get("status") ?? "all"} />;
  if (role === "admin" && screen === "drivers")
    return id ? <DriverReview uid={id} /> : <DriverQueue />;
  if (role === "admin" && screen === "support")
    return id ? (
      <TicketThread id={id} workspace="admin" admin />
    ) : (
      <Tickets workspace="admin" admin />
    );
  if (role === "admin" && screen === "demo") return <DemoTools />;
  if (screen === "help") {
    if (id === "new") return <NewTicket workspace={workspace} />;
    if (id === "tickets")
      return action ? (
        <TicketThread id={action} workspace={workspace} />
      ) : (
        <Tickets workspace={workspace} />
      );
    return <Help workspace={workspace} />;
  }
  return null;
}
