import { z } from "zod";
export const roles = ["rider", "driver", "admin"] as const;
export type Role = (typeof roles)[number];
export const placeSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    source: z.enum(["search", "pin", "gps", "simulation"]),
    providerPlaceId: z.string().max(256).optional(),
  })
  .strict();
export type Place = z.infer<typeof placeSchema>;
export const profileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .regex(/^\+91[6-9][0-9]{9}$/, "Enter a valid +91 mobile number"),
  })
  .strict();
export const onboardSchema = profileSchema
  .extend({
    intent: z.enum(["rider", "driver"]),
    termsAccepted: z.literal(true),
  })
  .strict();
export const vehicleSchema = z
  .object({
    plate: z
      .string()
      .trim()
      .min(6)
      .max(16)
      .regex(/^[A-Za-z0-9 -]+$/),
    make: z.string().trim().min(2).max(40),
    model: z.string().trim().min(1).max(40),
    color: z.string().trim().min(2).max(30),
    seats: z.literal(4),
  })
  .strict();
export const versionSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();
export const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(5000),
    source: z.enum(["gps", "simulation"]),
    timestamp: z.number().int(),
    sequence: z.number().int().min(0),
    sessionId: z.string().uuid(),
  })
  .strict();
export type Location = z.infer<typeof locationSchema>;
export const ticketSchema = z
  .object({
    category: z.enum(["ride", "payment", "lost_item", "account", "other"]),
    subject: z.string().trim().min(5).max(100),
    body: z.string().trim().min(10).max(2000),
    rideId: z.string().max(128).nullable().default(null),
    workspace: z.enum(roles).default("rider"),
  })
  .strict();
export interface Fare {
  basePaise: number;
  distanceRatePaisePerKm: number;
  timeRatePaisePerMinute: number;
  minimumPaise: number;
  distanceChargePaise: number;
  timeChargePaise: number;
  roundingPaise: number;
  totalPaise: number;
  commissionBps: number;
  policyVersion: string;
  currency: "INR";
}
export interface Account {
  id: string;
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  roles: Role[];
  defaultWorkspace: Role;
  accountStatus: string;
  onboardingComplete: boolean;
  activeRideId: string | null;
  version: number;
  isDemo: boolean;
  emailVerified: boolean;
}
export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  seats: number;
  driverId: string;
  approvalStatus: string;
  applicationVersion: number;
}
export interface Driver {
  id: string;
  uid: string;
  approvalStatus: string;
  applicationVersion: number;
  availability: "offline" | "online" | "busy";
  activeRideId: string | null;
  activeVehicleId: string | null;
  reviewReason?: string;
  ratingSum: number;
  ratingCount: number;
  version: number;
  isDemo: boolean;
  lastLocation?: {
    lat: number;
    lng: number;
    geohash: string;
    updatedAt: string;
    source: string;
  };
  vehicle?: Vehicle;
  displayName?: string;
  sessionId?: string;
  simulationAllowed?: boolean;
}
export type RideStatus =
  | "searching"
  | "assigned"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";
export interface Person {
  uid: string;
  displayName: string;
  initials: string;
}
export interface Quote {
  id: string;
  quoteId: string;
  riderId: string;
  pickup: Place;
  destination: Place;
  distanceMeters: number;
  durationSeconds: number;
  fare: Fare;
  routeGeometry: { type: "LineString"; coordinates: number[][] };
  expiresAt: string;
  consumedByRideId: string | null;
  version: number;
}
export interface Ride extends Omit<Quote, "expiresAt" | "consumedByRideId"> {
  driverId: string | null;
  vehicleId: string | null;
  status: RideStatus;
  paymentStatus:
    | "not_due"
    | "pending"
    | "processing"
    | "paid"
    | "failed"
    | "review_required";
  riderSnapshot: Person;
  driverSnapshot?: Person;
  vehicleSnapshot?: Vehicle;
  createdAt: string;
  updatedAt: string;
  searchExpiresAt: string;
  completedAt?: string;
  startedAt?: string;
  assignedAt?: string;
  arrivedAt?: string;
  paymentId: string | null;
  reviewId: string | null;
  trackingMode: string | null;
  accessSyncPending: boolean;
  finalFarePaise: number | null;
  cancellationReason?: string;
  cancelledByRole?: string;
  driverRating?: number | null;
  events?: { eventType: string; createdAt: string }[];
  payment?: Payment;
  review?: Review;
}
export interface Offer {
  id: string;
  rideId: string;
  rideVersion: number;
  pickup: Place;
  destination: Place;
  farePaise: number;
  distanceMeters: number;
  durationSeconds: number;
  pickupDistanceMeters: number;
  expiresAt: string;
  status: string;
}
export interface Payment {
  id: string;
  rideId: string;
  providerOrderId: string | null;
  capturedPaymentId: string | null;
  amountPaise: number;
  currency: "INR";
  status: string;
  orderCreationState: string;
  driverSharePaise: number;
  platformSharePaise: number;
  receiptId: string | null;
}
export interface Review {
  stars: number;
  comment: string;
}
export interface Ticket {
  id: string;
  ownerId: string;
  ownerWorkspace: Role;
  subject: string;
  category: string;
  status: string;
  rideId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  hasAdminReply: boolean;
  messages?: Message[];
  nextCursor?: string | null;
}
export interface Message {
  id: string;
  body: string;
  authorId: string;
  authorRole: Role;
  createdAt: string;
}
export interface Ledger {
  id: string;
  rideId: string;
  grossPaise: number;
  driverSharePaise: number;
  platformSharePaise: number;
  capturedAt: string;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
export const date = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
