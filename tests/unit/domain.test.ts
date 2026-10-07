import { describe, it, expect } from "vitest";
import { fare, distance, canCancel, terminal, safeNext } from "@/lib/domain";
import { placeSchema, profileSchema } from "@/contracts";
describe("locked fare and boundaries", () => {
  it("computes the documented 5 km / 15 minute fare in integer paise", () => {
    expect(fare(5000, 900).totalPaise).toBe(11500);
  });
  it("enforces the minimum and rounds up to whole rupees", () => {
    expect(fare(201, 30).totalPaise).toBe(8000);
    const f = fare(5312, 917);
    expect(f.totalPaise % 100).toBe(0);
    expect(f.totalPaise).toBeGreaterThanOrEqual(
      f.basePaise + f.distanceChargePaise + f.timeChargePaise,
    );
  });
  it("allows cancellation only before start", () => {
    expect(canCancel("arrived")).toBe(true);
    expect(canCancel("in_progress")).toBe(false);
    expect(terminal("completed")).toBe(true);
    expect(terminal("assigned")).toBe(false);
  });
  it("rejects open redirects and accepts scoped return paths", () => {
    for (const p of [
      "https://evil.test",
      "//evil.test",
      "/rider\\evil",
      "/rider//evil",
      "/sign-in",
    ])
      expect(safeNext(p)).toBe("/rider");
    expect(safeNext("/driver/history")).toBe("/driver/history");
  });
  it("rejects forged amount and invalid locations/profile fields", () => {
    expect(
      placeSchema.safeParse({ lat: 91, lng: 77, label: "Place", source: "pin" })
        .success,
    ).toBe(false);
    expect(
      placeSchema.safeParse({
        lat: 12,
        lng: 77,
        label: "Place",
        source: "pin",
        amount: 1,
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        displayName: "A",
        phone: "123",
        roles: ["admin"],
      }).success,
    ).toBe(false);
  });
  it("calculates geographic distance for proximity filtering", () => {
    expect(
      distance({ lat: 12.9716, lng: 77.5946 }, { lat: 12.9716, lng: 77.5946 }),
    ).toBe(0);
    expect(
      distance({ lat: 12.9716, lng: 77.5946 }, { lat: 13.0716, lng: 77.5946 }),
    ).toBeGreaterThan(10000);
  });
});
