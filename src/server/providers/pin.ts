import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { ensure, now } from "@/server/core";
function key() {
  const value = process.env.TRIP_PIN_ENCRYPTION_KEY;
  ensure(
    value && /^[a-f0-9]{64}$/i.test(value),
    503,
    "CONFIGURATION_UNAVAILABLE",
    "Trip verification is being configured.",
  );
  return Buffer.from(value, "hex");
}
function digest(id: string, pin: string) {
  ensure(
    process.env.TRIP_PIN_HMAC_KEY,
    503,
    "CONFIGURATION_UNAVAILABLE",
    "Trip verification is being configured.",
  );
  return createHmac("sha256", process.env.TRIP_PIN_HMAC_KEY)
    .update(`${id}:${pin}`)
    .digest("hex");
}
export function secret(id: string) {
  const pin = String(randomInt(10000)).padStart(4, "0"),
    nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce),
    encrypted = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return {
    schemaVersion: 1,
    createdAt: now(),
    pinCiphertext: encrypted.toString("hex"),
    pinNonce: nonce.toString("hex"),
    pinTag: cipher.getAuthTag().toString("hex"),
    pinHmac: digest(id, pin),
    keyVersion: "v1",
  };
}
export function reveal(s: {
  pinCiphertext: string;
  pinNonce: string;
  pinTag: string;
}) {
  const d = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(s.pinNonce, "hex"),
  );
  d.setAuthTag(Buffer.from(s.pinTag, "hex"));
  return Buffer.concat([
    d.update(Buffer.from(s.pinCiphertext, "hex")),
    d.final(),
  ]).toString("utf8");
}
export function matches(id: string, pin: string, hmac: string) {
  const actual = digest(id, pin);
  return (
    actual.length === hmac.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(hmac))
  );
}
