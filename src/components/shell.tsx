"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CarFront,
  Clock3,
  LifeBuoy,
  UserRound,
  LogOut,
  MapPin,
  LayoutDashboard,
  UsersRound,
  IndianRupee,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { Brand, Banner, Button, Loading, Modal } from "./ui";
import { initials, type Role } from "@/contracts";
const navs: Record<Role, { label: string; href: string; icon: LucideIcon }[]> =
  {
    rider: [
      { label: "Book a ride", href: "/rider", icon: CarFront },
      { label: "Activity", href: "/rider/history", icon: Clock3 },
      { label: "Help & support", href: "/rider/help", icon: LifeBuoy },
      { label: "Profile", href: "/rider/profile", icon: UserRound },
    ],
    driver: [
      { label: "Drive", href: "/driver", icon: CarFront },
      { label: "Activity", href: "/driver/history", icon: Clock3 },
      { label: "Earnings", href: "/driver/earnings", icon: IndianRupee },
      { label: "Profile", href: "/driver/profile", icon: UserRound },
    ],
    admin: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Drivers", href: "/admin/drivers", icon: UsersRound },
      { label: "Rides", href: "/admin/rides", icon: CarFront },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
    ],
  };
export function Shell({
  workspace,
  children,
  serverUid,
  demo,
  testFixtures = false,
}: {
  workspace: Role;
  children: ReactNode;
  serverUid: string;
  demo: boolean;
  testFixtures?: boolean;
}) {
  const auth = useAuth(),
    path = usePathname(),
    router = useRouter(),
    [logoutWarning, setLogoutWarning] = useState(false);
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  }, [path]);
  useEffect(() => {
    if (!auth.loading && (!auth.user || auth.user.uid !== serverUid))
      void auth.logout();
  }, [auth, serverUid]);
  const nav = navs[workspace];
  const active = (href: string) =>
    href === `/${workspace}` ? path === href : path.startsWith(href);
  async function signout() {
    if (workspace === "driver" && auth.driver?.activeRideId)
      setLogoutWarning(true);
    else await auth.logout();
  }
  const lock =
    workspace === "driver"
      ? auth.driver?.activeRideId
      : auth.profile?.activeRideId;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand href={`/${workspace}`} />
        <nav aria-label={`${workspace} navigation`}>
          {nav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              className={`nav-item ${active(href) ? "active" : ""}`}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          ))}
          {workspace === "admin" && demo && (
            <Link
              className={`nav-item ${active("/admin/demo") ? "active" : ""}`}
              href="/admin/demo"
            >
              <FlaskConical size={20} />
              <span>Demo tools</span>
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          {workspace === "driver" && (
            <Link href="/driver/help" className="nav-item">
              <LifeBuoy size={20} />
              <span>Help & support</span>
            </Link>
          )}
          <div className="sidebar-context">
            <strong>A journey in good hands.</strong>
            <p>
              Controlled release with test payments. No real money collected.
            </p>
          </div>
          <Button variant="ghost" className="sidebar-logout" onClick={signout}>
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div className="header-left">
            <MapPin size={17} />
            <span>Bengaluru</span>
            <span className="demo-pill">Test payments</span>
          </div>
          <div className="header-right">
            {auth.profile && auth.profile.roles.length > 1 && (
              <select
                className="role-select"
                aria-label="Switch workspace"
                value={workspace}
                onChange={(e) => router.push(`/${e.target.value}`)}
              >
                {auth.profile.roles.map((r) => (
                  <option key={r} value={r}>
                    {r === "rider"
                      ? "Passenger"
                      : r === "driver"
                        ? "Driver"
                        : "Administrator"}
                  </option>
                ))}
              </select>
            )}
            <Link
              className="header-avatar"
              href={`/${workspace === "admin" ? "rider" : workspace}/profile`}
              aria-label="Your profile"
            >
              <span className="avatar">
                {initials(auth.profile?.displayName ?? "SF")}
              </span>
              <span>
                {auth.profile?.displayName ?? "Your account"}
                <small>
                  {workspace === "rider"
                    ? "Passenger"
                    : workspace === "driver"
                      ? "Driver"
                      : "Administrator"}
                </small>
              </span>
            </Link>
          </div>
        </header>
        <main className="workspace-main" id="main">
          {testFixtures && (
            <Banner kind="warning">
              Automated test fixtures — map routes and payment provider
              responses are simulated.
            </Banner>
          )}
          {!auth.online && (
            <Banner kind="warning">
              You’re offline. Reconnect to continue.{" "}
              <button onClick={() => auth.refresh()}>Retry connection</button>
            </Banner>
          )}
          {auth.error && (
            <Banner kind="error">
              {auth.error} <button onClick={() => auth.refresh()}>Retry</button>
            </Banner>
          )}
          {lock && !path.includes(`/rides/${lock}`) && (
            <div className="active-banner">
              <CarFront size={18} />
              <span>You have a ride to continue.</span>
              <Link href={`/${workspace}/rides/${lock}`}>Open ride</Link>
            </div>
          )}
          {auth.loading ? <Loading /> : children}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={active(href) ? "active" : ""}>
            <Icon size={21} strokeWidth={1.75} />
            <span>
              {label === "Book a ride"
                ? "Book"
                : label === "Help & support"
                  ? "Help"
                  : label}
            </span>
          </Link>
        ))}
      </nav>
      <Modal
        open={logoutWarning}
        onOpenChange={setLogoutWarning}
        title="You have an active trip"
        description="Signing out pauses your location sharing. Your trip stays active and you’ll need to sign in again to finish it."
      >
        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setLogoutWarning(false);
              router.push(`/driver/rides/${auth.driver!.activeRideId}`);
            }}
          >
            Return to trip
          </Button>
          <Button variant="danger" onClick={() => auth.logout()}>
            Sign out anyway
          </Button>
        </div>
      </Modal>
    </div>
  );
}
