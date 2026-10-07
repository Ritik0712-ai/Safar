"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { CarFront, LogOut } from "lucide-react";
import { firebase } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth-provider";
import { Heading, Button, Banner, Status, Modal } from "@/components/ui";
import { useMutation } from "@/lib/hooks";
import { initials, type Role } from "@/contracts";
export function Profile({ workspace }: { workspace: Role }) {
  const auth = useAuth(),
    router = useRouter(),
    m = useMutation(),
    [saved, setSaved] = useState(""),
    [name, setName] = useState(auth.profile?.displayName ?? ""),
    [phone, setPhone] = useState(auth.profile?.phone ?? ""),
    [driverDialog, setDriverDialog] = useState(false),
    [discard, setDiscard] = useState<string | null>(null);
  const dirty =
    !!auth.profile &&
    (name !== auth.profile.displayName || phone !== auth.profile.phone);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await m.run(
      "me",
      { displayName: name, phone },
      async () => {
        await auth.refresh();
        setSaved("Your profile is updated.");
      },
      "PATCH",
    );
  }
  function leave(path: string) {
    if (dirty) setDiscard(path);
    else router.push(path);
  }
  return (
    <div className="form-page">
      <Heading
        title="Your profile"
        description="A few details that make the journey yours."
      />
      <section className="panel">
        <div className="profile-avatar">
          <span className="avatar">
            {initials(auth.profile?.displayName ?? "SF")}
          </span>
          <div>
            <h2>{auth.profile?.displayName}</h2>
            <p>{workspace === "driver" ? "Driver" : "Passenger"} account</p>
          </div>
        </div>
        {saved && <Banner kind="success">{saved}</Banner>}
        {m.error && <Banner kind="error">{m.error}</Banner>}
        <form className="form-stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved("");
              }}
              minLength={2}
              maxLength={80}
              required
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSaved("");
              }}
              pattern="\+91[6-9][0-9]{9}"
              required
              autoComplete="tel"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" value={auth.user?.email ?? ""} readOnly />
            <small>
              {auth.user?.emailVerified
                ? "Email verified"
                : "Email verification required"}
            </small>
          </div>
          <Button disabled={!dirty || !auth.online} busy={m.busy}>
            Save changes
          </Button>
        </form>
        {auth.user?.providerData.some((p) => p.providerId === "password") && (
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await sendPasswordResetEmail(
                  firebase()!.auth,
                  auth.user!.email!,
                );
                setSaved("A password reset link was sent.");
              } catch {
                m.setError(
                  "The reset email could not be sent. Please try again.",
                );
              }
            }}
          >
            Reset password
          </Button>
        )}
        {workspace === "driver" && auth.driver && (
          <div className="notice-panel">
            <div className="row-between">
              <h3>Your vehicle</h3>
              <Status value={auth.driver.approvalStatus} />
            </div>
            <p>
              {auth.driver.vehicle?.make} {auth.driver.vehicle?.model}
              <br />
              {auth.driver.vehicle?.plate ??
                "Complete your driver application."}
            </p>
            <Button
              variant="secondary"
              disabled={!!auth.driver.activeRideId}
              onClick={() => leave("/driver/application")}
            >
              Edit vehicle
            </Button>
          </div>
        )}
        <div className="switch-links">
          {workspace === "driver" ? (
            <Button variant="secondary" onClick={() => leave("/rider")}>
              Switch to passenger
            </Button>
          ) : auth.profile?.roles.includes("driver") ? (
            <Button variant="secondary" onClick={() => leave("/driver")}>
              Switch to driver
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setDriverDialog(true)}>
              <CarFront size={17} />
              Become a driver
            </Button>
          )}
        </div>
        <div className="action-stack">
          <Button variant="ghost" onClick={() => leave(`/${workspace}/help`)}>
            Help & support
          </Button>
          <div className="row-between">
            <Link className="text-link" href="/privacy">
              Privacy notice
            </Link>
            <Link className="text-link" href="/terms">
              Demo terms
            </Link>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (dirty) setDiscard("logout");
              else if (workspace === "driver" && auth.driver?.activeRideId)
                setDiscard("logout");
              else void auth.logout();
            }}
          >
            <LogOut size={17} />
            Sign out
          </Button>
        </div>
      </section>
      <Modal
        open={driverDialog}
        onOpenChange={setDriverDialog}
        title="Take the driver’s seat"
        description="This adds a driver workspace to your account. Your vehicle will need administrator approval before you can receive rides."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDriverDialog(false)}>
            Not now
          </Button>
          <Button
            busy={m.busy}
            onClick={() =>
              m.run(
                "me/onboarding",
                {
                  displayName: name,
                  phone,
                  intent: "driver",
                  termsAccepted: true,
                },
                async () => {
                  await auth.refresh();
                  router.push("/driver/application");
                },
              )
            }
          >
            Start application
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!discard}
        onOpenChange={(o) => !o && setDiscard(null)}
        title={dirty ? "Discard unsaved changes?" : "You have an active trip"}
        description={
          dirty
            ? "Your profile edits haven’t been saved."
            : "Signing out pauses location sharing. Sign back in to finish your active trip."
        }
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDiscard(null)}>
            Stay
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (discard === "logout") void auth.logout();
              else if (discard) router.push(discard);
              setDiscard(null);
            }}
          >
            {dirty ? "Discard changes" : "Sign out anyway"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
