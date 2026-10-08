"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updateProfile,
} from "firebase/auth";
import { Mail, CheckCircle2 } from "lucide-react";
import { firebase } from "@/lib/firebase/client";
import { safeNext } from "@/lib/domain";
import { api, exchange, useAuth } from "./auth-provider";
import { Brand, Button, Banner } from "./ui";
import type { Account } from "@/contracts";
export function AuthScreens({ screen }: { screen: string }) {
  const redirectHandled = useRef(false);
  const router = useRouter(),
    params = useSearchParams(),
    auth = useAuth();
  const [intent, setIntent] = useState(
      params.get("intent") === "driver" ? "driver" : "rider",
    ),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [googleBlocked, setGoogleBlocked] = useState(false),
    [actionReady, setActionReady] = useState(false);
  useEffect(() => {
    if (cooldown) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);
  useEffect(() => {
    if (screen === "auth/action") {
      const code = params.get("oobCode"),
        mode = params.get("mode"),
        f = firebase();
      if (!f || !code) {
        setError("This link is invalid. Request a new link.");
        return;
      }
      if (mode === "verifyEmail")
        applyActionCode(f.auth, code)
          .then(() =>
            setSuccess("Your email is verified. You can now sign in."),
          )
          .catch(() =>
            setError("This verification link expired. Request a new link."),
          );
      else if (mode === "resetPassword")
        verifyPasswordResetCode(f.auth, code)
          .then(() => setActionReady(true))
          .catch(() =>
            setError("This password reset link expired. Request a new link."),
          );
      else setError("This action link is unavailable.");
    }
  }, [params, screen]);
  async function continueAccount() {
    await exchange();
    const { profile } = await api<{ profile: Account | null }>("me");
    await auth.refresh();
    if (!profile) {
      router.push(`/onboarding?intent=${intent}`);
      return;
    }
    if (!firebase()!.auth.currentUser?.emailVerified) {
      router.push("/verify-email");
      return;
    }
    const fallback =
      profile.defaultWorkspace === "admin"
        ? "/admin"
        : intent === "driver" && profile.roles.includes("driver")
          ? "/driver"
          : profile.defaultWorkspace === "driver"
            ? "/driver"
            : "/rider";
    router.push(safeNext(params.get("next"), fallback));
    router.refresh();
  }
  useEffect(() => {
    if (!["sign-in", "sign-up"].includes(screen) || redirectHandled.current)
      return;
    redirectHandled.current = true;
    const f = firebase();
    if (!f) return;
    void getRedirectResult(f.auth)
      .then((result) => {
        if (result)
          void continueAccount().catch((e) =>
            setError(
              e instanceof Error ? e.message : "Sign in again to continue.",
            ),
          );
      })
      .catch(() =>
        setError("Google sign-in could not complete. Use email or try again."),
      );
    // The redirect result is consumed once per mount, including SDK persistence recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  async function google(redirect = false) {
    setBusy(true);
    setError("");
    try {
      const f = firebase();
      if (!f)
        throw new Error(
          "Sign-in is being connected. Please try again shortly.",
        );
      const provider = new GoogleAuthProvider();
      if (redirect) {
        await signInWithRedirect(f.auth, provider);
        return;
      }
      await signInWithPopup(f.auth, provider);
      await continueAccount();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked") setGoogleBlocked(true);
      else if (code !== "auth/popup-closed-by-user")
        setError("Google sign-in could not complete. Try again or use email.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const b = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      const f = firebase();
      if (!f)
        throw new Error(
          "Sign-in is being connected. Please try again shortly.",
        );
      if (screen === "sign-in") {
        await signInWithEmailAndPassword(f.auth, b.email, b.password);
        await continueAccount();
      } else if (screen === "sign-up") {
        if (b.password !== b.confirm)
          throw new Error("Your passwords do not match.");
        if (b.password.length < 10)
          throw new Error("Use at least 10 characters for your password.");
        const credential = await createUserWithEmailAndPassword(
          f.auth,
          b.email,
          b.password,
        );
        await updateProfile(credential.user, { displayName: b.displayName });
        await sendEmailVerification(credential.user, {
          url: window.location.origin + "/sign-in",
        });
        await exchange();
        router.push(`/onboarding?intent=${intent}`);
        router.refresh();
      } else if (screen === "onboarding") {
        await api("me/onboarding", {
          displayName: b.displayName,
          phone: b.phone,
          intent,
          termsAccepted: true,
        });
        await auth.refresh();
        await exchange();
        router.push(
          f.auth.currentUser?.emailVerified
            ? intent === "driver"
              ? "/driver/application"
              : "/rider"
            : "/verify-email",
        );
        router.refresh();
      } else if (screen === "forgot-password") {
        await sendPasswordResetEmail(f.auth, b.email, {
          url: window.location.origin + "/sign-in",
        }).catch((err) => {
          if (!["auth/user-not-found", "auth/invalid-email"].includes(err.code))
            throw err;
        });
        setSuccess("If an account exists, you’ll receive a reset link.");
      } else if (screen === "auth/action") {
        if (b.password.length < 10)
          throw new Error("Use at least 10 characters.");
        if (b.password !== b.confirm)
          throw new Error("Your passwords do not match.");
        await confirmPasswordReset(f.auth, params.get("oobCode")!, b.password);
        setSuccess("Password updated. Sign in with your new password.");
        setActionReady(false);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "auth/invalid-credential"
          ? "Email or password is incorrect. Try again."
          : code === "auth/email-already-in-use"
            ? "Try signing in or resetting your password."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Please try again later."
              : code?.startsWith("auth/")
                ? "Authentication could not complete. Please try again."
                : err instanceof Error
                  ? err.message
                  : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verified() {
    setBusy(true);
    setError("");
    try {
      await firebase()!.auth.currentUser!.reload();
      if (!firebase()!.auth.currentUser!.emailVerified)
        throw new Error(
          "Your email is not verified yet. Open the verification link in your inbox.",
        );
      await continueAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      await api("me/verification-email", {});
      setSuccess("A new verification link was sent.");
      setCooldown(60);
    } catch {
      setError("The link could not be sent. Please try again later.");
    } finally {
      setBusy(false);
    }
  }
  const signup = screen === "sign-up",
    onboarding = screen === "onboarding",
    verify = screen === "verify-email",
    forgot = screen === "forgot-password",
    action = screen === "auth/action";
  const title = signup
    ? "Make the city yours."
    : onboarding
      ? "A little about you."
      : verify
        ? "Check your inbox."
        : forgot
          ? "Let’s get you back in."
          : action
            ? "Your account, secured."
            : "Good to see you.";
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div>
          <h2>
            A little closer.
            <br />A little simpler.
          </h2>
          <p>
            From familiar streets to somewhere new. Your next journey starts
            with Safar.
          </p>
        </div>
        <small>Bengaluru · Controlled test-payment release</small>
      </aside>
      <main className="auth-content" id="main">
        <div className="auth-form">
          <Brand />
          <h1>{title}</h1>
          <p>
            {signup
              ? "Create an account for your next journey."
              : onboarding
                ? "Complete your profile before taking your first ride."
                : verify
                  ? "Open the verification link we sent to your email."
                  : forgot
                    ? "Enter your email to receive a password reset link."
                    : action
                      ? "Complete the secure action from your email."
                      : "Sign in and pick up where you left off."}
          </p>
          {!auth.configured && (
            <Banner kind="warning">
              Sign-in is being connected to Safar. Please try again shortly.
            </Banner>
          )}
          {error && <Banner kind="error">{error}</Banner>}
          {success && (
            <Banner kind="success">
              <CheckCircle2 size={16} />
              {success}
            </Banner>
          )}
          {verify ? (
            <div className="form-stack">
              <div className="notice-panel">
                <Mail size={26} />
                <p>
                  {auth.user?.email?.replace(/(.{2}).*(@.*)/, "$1••••$2") ??
                    "Your registered email"}
                </p>
              </div>
              <Button busy={busy} onClick={verified}>
                I’ve verified my email
              </Button>
              <Button
                variant="secondary"
                busy={busy}
                disabled={cooldown > 0}
                onClick={resend}
              >
                {cooldown
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
              </Button>
              <Button variant="ghost" onClick={() => auth.logout()}>
                Use another account
              </Button>
            </div>
          ) : (
            <>
              {(!action || actionReady) && !success && (
                <form className="form-stack" onSubmit={submit}>
                  {(signup || onboarding) && (
                    <>
                      <div
                        className="intent-switch"
                        aria-label="Choose your workspace"
                      >
                        <button
                          type="button"
                          onClick={() => setIntent("rider")}
                          className={intent === "rider" ? "active" : ""}
                        >
                          Passenger
                        </button>
                        <button
                          type="button"
                          onClick={() => setIntent("driver")}
                          className={intent === "driver" ? "active" : ""}
                        >
                          Driver
                        </button>
                      </div>
                      <div className="field">
                        <label htmlFor="displayName">Your name</label>
                        <input
                          name="displayName"
                          id="displayName"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={80}
                          defaultValue={auth.user?.displayName ?? ""}
                          placeholder="Full name"
                        />
                      </div>
                    </>
                  )}
                  {!onboarding && !action && (
                    <div className="field">
                      <label htmlFor="email">Email address</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="you@example.com"
                      />
                    </div>
                  )}
                  {onboarding && (
                    <div className="field">
                      <label htmlFor="phone">Mobile number</label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        pattern="\+91[6-9][0-9]{9}"
                        placeholder="+91 9876543210"
                      />
                      <small>
                        Include +91 followed by your ten-digit number.
                      </small>
                    </div>
                  )}
                  {!onboarding && !forgot && (
                    <div className="field">
                      <label htmlFor="password">
                        {action ? "New password" : "Password"}
                      </label>
                      <div className="password-wrap">
                        <input
                          id="password"
                          name="password"
                          type={show ? "text" : "password"}
                          autoComplete={
                            signup || action
                              ? "new-password"
                              : "current-password"
                          }
                          required
                          minLength={signup || action ? 10 : 1}
                        />
                        <button type="button" onClick={() => setShow(!show)}>
                          {show ? "Hide" : "Show"}
                        </button>
                      </div>
                      {signup && <small>Use at least 10 characters.</small>}
                    </div>
                  )}
                  {(signup || action) && (
                    <div className="field">
                      <label htmlFor="confirm">Confirm password</label>
                      <input
                        id="confirm"
                        name="confirm"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={10}
                      />
                    </div>
                  )}
                  {(signup || onboarding) && (
                    <label className="check-field">
                      <input type="checkbox" required />
                      <span>
                        I agree to the <Link href="/terms">demo terms</Link> and{" "}
                        <Link href="/privacy">privacy notice</Link>. Driver
                        applications require review.
                      </span>
                    </label>
                  )}
                  {screen === "sign-in" && (
                    <Link className="text-link" href="/forgot-password">
                      Forgot password?
                    </Link>
                  )}
                  <Button
                    busy={busy}
                    disabled={!auth.configured || !auth.online}
                    className="full"
                  >
                    {signup
                      ? "Create account"
                      : onboarding
                        ? "Continue"
                        : forgot
                          ? "Send reset link"
                          : action
                            ? "Save password"
                            : "Sign in"}
                  </Button>
                </form>
              )}
              {(screen === "sign-in" || signup) && (
                <>
                  <div className="divider">or</div>
                  <Button
                    variant="secondary"
                    className="full"
                    busy={busy}
                    disabled={!auth.configured}
                    onClick={() => google()}
                  >
                    Continue with Google
                  </Button>
                  {googleBlocked && (
                    <Button
                      variant="secondary"
                      className="full"
                      onClick={() => google(true)}
                    >
                      Continue in this browser
                    </Button>
                  )}
                </>
              )}
              {action && (success || error) && (
                <Link href="/sign-in" className="button primary full">
                  Continue to sign in
                </Link>
              )}
              <p className="auth-bottom">
                {signup ? (
                  <>
                    Already have an account?{" "}
                    <Link href="/sign-in">Sign in</Link>
                  </>
                ) : screen === "sign-in" ? (
                  <>
                    New to Safar? <Link href="/sign-up">Create an account</Link>
                  </>
                ) : (
                  !onboarding && <Link href="/sign-in">Back to sign in</Link>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
