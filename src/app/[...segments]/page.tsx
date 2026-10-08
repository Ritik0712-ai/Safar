import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { admin } from "@/lib/firebase/admin";
import { AuthScreens } from "@/components/auth-screens";
import { Workspace } from "@/components/workspace";
import { Shell } from "@/components/shell";
import { Brand, Loading, Banner } from "@/components/ui";
import type { Role } from "@/contracts";
const authRoutes = [
  "sign-in",
  "sign-up",
  "forgot-password",
  "onboarding",
  "verify-email",
  "auth/action",
];
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{
    segments: string[];
  }>;
}) {
  const { segments } = await params,
    path = segments.join("/"),
    [workspace, screen] = segments;
  if (workspace === "driver" && screen === "rides" && segments[3]) notFound();
  if (path === "privacy" || path === "terms")
    return (
      <main id="main" className="notice">
        <Brand />
        <h1>
          {path === "privacy"
            ? "Your journey. Your privacy."
            : "Safar demo terms"}
        </h1>
        <p>
          Safar is a controlled student and portfolio cab-booking release for
          Bengaluru. Payments use Razorpay Test Mode. No real money, driver
          payouts, tax invoices or public transport operations are offered.
        </p>
        <h2>
          {path === "privacy"
            ? "What is saved"
            : "Using the controlled release"}
        </h2>
        <p>
          {path === "privacy"
            ? "Account profile details, selected endpoints, ride stages, test payment references, ratings and private support conversations are stored. Precise driver location is shared only with the assigned passenger during a trip. Location sharing requires an open browser and pauses when the browser is closed or backgrounded."
            : "Use separate passenger and driver accounts for a demonstration. Driver approval is a controlled-project review and does not represent legal registration verification, identity certification or transport KYC. Agreed demo fares are fixed at booking."}
        </p>
        <h2>Who can access your records</h2>
        <p>
          Passengers and assigned drivers can access their own rides. Support
          conversations are visible only to their owner and authorized
          administrators. Administrators can inspect operational records; they
          cannot manually fabricate captured payments.
        </p>
        <h2>Keeping records</h2>
        <p>
          Live locations are removed after trips. Unused quotes and operation
          records are retained briefly for recovery. Demo journeys and support
          records have a proposed 90-day retention; captured test financial
          records and audit records have a proposed 180-day retention. Account
          and data concerns can be raised through Help & support.
        </p>
        <h2>Support and safety</h2>
        <p>
          Support is an in-app request system and is not an emergency response
          service. Drivers should interact only while stationary. Browser
          location cannot guarantee background or continuous tracking.
        </p>
        <Link className="button primary" href="/">
          Back to Safar
        </Link>
      </main>
    );
  const protectedAuth = path === "onboarding" || path === "verify-email";
  if (authRoutes.includes(path) && !protectedAuth)
    return (
      <Suspense fallback={<Loading />}>
        <AuthScreens screen={path} />
      </Suspense>
    );
  const valid =
    /^(rider|driver)(\/(history|profile|help(\/new|\/tickets(\/[a-zA-Z0-9_-]+)?)?|rides\/[a-zA-Z0-9_-]+(\/(payment|receipt|rate))?))?$/.test(
      path,
    ) ||
    path === "rider/review" ||
    /^driver\/(application(\/status)?|earnings)$/.test(path) ||
    /^admin(\/(drivers(\/[a-zA-Z0-9_-]+)?|rides(\/[a-zA-Z0-9_-]+)?|support(\/[a-zA-Z0-9_-]+)?|demo|help\/new|help\/tickets\/[a-zA-Z0-9_-]+))?$/.test(
      path,
    );
  if (!valid && !protectedAuth) notFound();
  const session = (await cookies()).get("safar_session")?.value;
  let identity;
  try {
    if (session)
      identity = await admin().auth.verifySessionCookie(session, true);
  } catch {}
  if (!identity) redirect(`/sign-in?next=${encodeURIComponent("/" + path)}`);
  const user = await admin().db.doc(`users/${identity.uid}`).get();
  if (protectedAuth)
    return (
      <Suspense fallback={<Loading />}>
        <AuthScreens screen={path} />
      </Suspense>
    );
  if (!user.exists) redirect("/onboarding");
  const data = user.data()!;
  if (data.accountStatus !== "active")
    return (
      <main id="main" className="notice">
        <Brand />
        <h1>Your account is unavailable</h1>
        <Banner kind="warning">
          Contact the project operator for help with account access.
        </Banner>
      </main>
    );
  if (
    !data.roles.includes(workspace) ||
    (workspace === "admin" && identity.admin !== true)
  )
    return (
      <main id="main" className="notice">
        <Brand />
        <h1>This workspace is unavailable for your account</h1>
        <Link className="button primary" href="/rider">
          Go to my dashboard
        </Link>
      </main>
    );
  if (!identity.email_verified) redirect("/verify-email");
  if (workspace === "driver" && !screen) {
    const d = await admin().db.doc(`drivers/${identity.uid}`).get();
    if (d.data()?.approvalStatus !== "approved")
      redirect(
        d.data()?.approvalStatus === "draft"
          ? "/driver/application"
          : "/driver/application/status",
      );
  }
  const demo =
    process.env.DEMO_MODE === "true" && process.env.APP_ENV !== "production";
  if (path === "admin/demo" && !demo) notFound();
  return (
    <Shell
      workspace={workspace as Role}
      serverUid={identity.uid}
      demo={demo}
      testFixtures={
        process.env.APP_ENV === "test" &&
        process.env.TEST_PROVIDER_FIXTURES === "true" &&
        !!process.env.FIRESTORE_EMULATOR_HOST &&
        !process.env.VERCEL
      }
    >
      <Suspense fallback={<Loading />}>
        <Workspace segments={segments} />
      </Suspense>
    </Shell>
  );
}
