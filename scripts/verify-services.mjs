// Read-only checks against actual providers. Never print URLs containing keys.
const env = process.env;
for (const key of [
  "GEOAPIFY_SERVER_KEY",
  "NEXT_PUBLIC_GEOAPIFY_TILE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
])
  if (!env[key]) throw new Error(`Missing ${key}`);
if (!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))
  throw new Error("Service verification requires Razorpay Test Mode.");
if (env.GEOAPIFY_SERVER_KEY === env.NEXT_PUBLIC_GEOAPIFY_TILE_KEY)
  throw new Error("Browser and server mapping keys must be distinct.");

async function request(name, url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`${name} did not respond`);
  }
  if (!response.ok)
    throw new Error(`${name} rejected the request (${response.status})`);
  return response;
}
const geo = (path, params) => {
  const url = new URL(`https://api.geoapify.com/v1/${path}`);
  for (const [key, value] of Object.entries({
    ...params,
    apiKey: env.GEOAPIFY_SERVER_KEY,
  }))
    url.searchParams.set(key, value);
  return url;
};
const search = await (
  await request(
    "Address search",
    geo("geocode/autocomplete", {
      text: "Cubbon Park",
      filter: "circle:77.5946,12.9716,25000",
      limit: "1",
    }),
  )
).json();
if (!search.features?.length)
  throw new Error("Address search returned no test location");
console.log("Actual address search: passed");
const route = await (
  await request(
    "Road route",
    geo("routing", {
      waypoints: "12.9716,77.5946|12.9757,77.6068",
      mode: "drive",
    }),
  )
).json();
const feature = route.features?.[0];
if (
  !(feature?.properties?.distance > 200) ||
  !feature.geometry?.coordinates?.length
)
  throw new Error("Road route returned incomplete geometry");
console.log("Actual road route: passed", {
  meters: feature.properties.distance,
  seconds: Math.round(feature.properties.time),
});
await request(
  "Razorpay test credentials",
  "https://api.razorpay.com/v1/orders?count=1",
  {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET,
        ).toString("base64"),
    },
  },
);
console.log(
  "Razorpay Test Mode credentials: passed (read-only; no payment created)",
);
if (env.APP_ORIGIN) {
  const origin = new URL(env.APP_ORIGIN);
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw new Error("Website health requires HTTPS or localhost");
  await request("Website health", new URL("/api/health", origin));
  console.log("Configured website health: passed");
}
