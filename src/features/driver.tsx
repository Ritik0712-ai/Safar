"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CarFront, Radio, IndianRupee } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { CityMap } from "@/components/map-loader";
import {
  Heading,
  Button,
  Banner,
  Empty,
  Loading,
  Status,
  Endpoints,
} from "@/components/ui";
import { useResource, useMutation } from "@/lib/hooks";
import { useOfferUpdates } from "@/lib/live";
import { useDriverLocation } from "@/components/location-provider";
import {
  type Driver,
  type Offer,
  type Page,
  type Ledger,
  money,
  date,
} from "@/contracts";
export function DriverDashboard() {
  const auth = useAuth(),
    router = useRouter(),
    d = useResource<Driver>("drivers/me", 10000),
    offers = useResource<Page<Offer>>("drivers/me/offers", 10000),
    earn = useResource<
      Page<Ledger> & {
        totalPaise: number;
        pendingPaise: number;
        todayTrips: number;
      }
    >("drivers/me/earnings?range=today", 15000),
    m = useMutation(),
    gps = useDriverLocation();
  useOfferUpdates(offers.refresh);
  if (d.loading) return <Loading />;
  if (!d.data)
    return (
      <Banner kind="error">
        {d.error || "Unable to load your driver profile."}
      </Banner>
    );
  const driver = d.data;
  async function online(sim = false) {
    try {
      await gps.start(sim);
      await m.run("drivers/me/availability", { online: true }, async () => {
        await d.refresh();
        await auth.refresh();
        await offers.refresh();
      });
    } catch (e) {
      gps.setError(
        e instanceof Error ? e.message : "Unable to start location.",
      );
    }
  }
  async function offline() {
    await m.run("drivers/me/availability", { online: false }, async () => {
      gps.stop();
      await d.refresh();
      await auth.refresh();
    });
  }
  return (
    <>
      <Heading
        title={`Hello, ${auth.profile?.displayName.split(" ")[0] ?? "driver"}.`}
        description="Your next trip starts right here."
      />
      <div className="availability-panel panel">
        <div>
          <div className="row-between">
            <h2>
              {driver.availability === "online"
                ? "Ready for the road."
                : driver.activeRideId
                  ? "You have an active trip."
                  : "Take your time. Go when ready."}
            </h2>
            <Status value={driver.availability} />
          </div>
          <p>
            {driver.availability === "online"
              ? "Keep this page open to receive requests."
              : "Go online with a fresh location to receive nearby requests."}
          </p>
        </div>
        <Button
          busy={m.busy}
          disabled={!auth.online || !!driver.activeRideId}
          variant={driver.availability === "online" ? "secondary" : "primary"}
          onClick={() =>
            driver.availability === "online" ? offline() : online()
          }
        >
          {driver.availability === "online" ? "Go offline" : "Go online"}
        </Button>
      </div>
      {gps.error && <Banner kind="warning">{gps.error}</Banner>}
      {m.error && <Banner kind="error">{m.error}</Banner>}
      {gps.simulation && gps.tracking && (
        <Banner>Simulated location — controlled demonstration.</Banner>
      )}
      {driver.activeRideId && (
        <Link
          className="button primary"
          href={`/driver/rides/${driver.activeRideId}`}
        >
          Continue trip
        </Link>
      )}
      <div className="driver-dashboard">
        <div>
          <div className="driver-map">
            <CityMap location={gps.location} />
          </div>
          <div className="metric-grid">
            <div className="metric">
              <p>Completed today</p>
              <strong>{earn.data?.todayTrips ?? "—"}</strong>
              <small>Actual completed trips</small>
            </div>
            <div className="metric">
              <p>Captured test earnings</p>
              <strong>{earn.data ? money(earn.data.totalPaise) : "—"}</strong>
              <small>Simulated earnings · Today</small>
            </div>
          </div>
          {earn.error && <Banner kind="error">{earn.error}</Banner>}
          {earn.data && (
            <p className="compact-note">
              Pending passenger payments: {money(earn.data.pendingPaise)} in
              simulated driver earnings.
            </p>
          )}
          {driver.simulationAllowed && (
            <div className="notice-panel">
              <h3>Try a controlled demonstration</h3>
              <p>
                Use an explicitly simulated location in central Bengaluru. Trip
                stages still require your confirmation.
              </p>
              <Button
                variant="secondary"
                busy={m.busy}
                disabled={!auth.online || !!driver.activeRideId}
                onClick={() => online(true)}
              >
                Use demo location & go online
              </Button>
            </div>
          )}
        </div>
        <aside>
          <div className="section-heading">
            <h2>Ride requests</h2>
            <Radio size={20} className="muted" />
          </div>
          {offers.loading ? (
            <Loading />
          ) : offers.error ? (
            <Banner kind="error">
              {offers.error}
              <Button onClick={offers.refresh}>Retry</Button>
            </Banner>
          ) : offers.data?.items.length ? (
            offers.data.items.map((o) => (
              <section className="offer panel" key={o.id}>
                <div className="offer-header">
                  <strong>{money(o.farePaise)}</strong>
                  <small className="muted">Economy</small>
                </div>
                <Endpoints
                  pickup={o.pickup.label}
                  destination={o.destination.label}
                />
                <div className="offer-meta">
                  <span>{(o.distanceMeters / 1000).toFixed(1)} km ride</span>
                  <span>
                    {(o.pickupDistanceMeters / 1000).toFixed(1)} km to pickup
                  </span>
                </div>
                <p className="compact-note">
                  Offer expires {date(o.expiresAt)}
                </p>
                <div className="offer-actions">
                  <Button
                    variant="secondary"
                    busy={m.busy}
                    onClick={() =>
                      m.run(`rides/${o.rideId}/decline`, {}, offers.refresh)
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    busy={m.busy}
                    disabled={!auth.online || driver.availability !== "online"}
                    onClick={() =>
                      m.run<{
                        rideId: string;
                      }>(
                        `rides/${o.rideId}/accept`,
                        { expectedVersion: o.rideVersion },
                        async (r) => {
                          await auth.refresh();
                          router.push(`/driver/rides/${r.rideId}`);
                        },
                      )
                    }
                  >
                    Accept
                  </Button>
                </div>
              </section>
            ))
          ) : (
            <Empty
              icon={CarFront}
              title={
                driver.availability === "online"
                  ? "Waiting for your next trip"
                  : "The road can wait"
              }
            >
              {driver.availability === "online"
                ? "You’re online. Nearby ride requests will appear here."
                : "Go online when you’re ready to receive ride requests."}
            </Empty>
          )}
        </aside>
      </div>
    </>
  );
}
export function DriverApplication() {
  const auth = useAuth(),
    router = useRouter(),
    d = useResource<Driver>("drivers/me"),
    m = useMutation(),
    [saveDraft, setSaveDraft] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    await m.run(
      "drivers/application",
      {
        ...data,
        seats: 4,
        intent: saveDraft ? "draft" : "submit",
        expectedVersion: d.data!.version,
      },
      async () => {
        await auth.refresh();
        router.push("/driver/application/status");
      },
    );
  }
  if (d.loading) return <Loading />;
  const v = d.data?.vehicle;
  return (
    <div className="form-page">
      <Heading
        title="Your vehicle. Your next chapter."
        description="Apply to drive in the Safar controlled release."
      />
      {d.data?.approvalStatus === "approved" && (
        <Banner kind="warning">
          Updating your vehicle takes you offline and requires a new review.
        </Banner>
      )}
      {d.data?.activeRideId && (
        <Banner kind="error">
          Finish your active trip before editing your vehicle.
        </Banner>
      )}
      {(m.error || d.error) && (
        <Banner kind="error">{m.error || d.error}</Banner>
      )}
      <form className="panel form-stack" onSubmit={submit}>
        <h2>Vehicle details</h2>
        <div className="form-grid">
          {[
            {
              key: "plate",
              title: "Registration number",
              placeholder: "KA 01 AB 1234",
              max: 16,
            },
            {
              key: "make",
              title: "Make",
              placeholder: "Maruti Suzuki",
              max: 40,
            },
            { key: "model", title: "Model", placeholder: "Dzire", max: 40 },
            { key: "color", title: "Colour", placeholder: "White", max: 30 },
          ].map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.title}</label>
              <input
                id={f.key}
                name={f.key}
                required
                maxLength={f.max}
                defaultValue={v?.[f.key as keyof typeof v]?.toString() ?? ""}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div className="field">
          <label>Passenger seats</label>
          <input value="4 · Safar Economy" readOnly />
        </div>
        <label className="check-field">
          <input type="checkbox" required />
          <span>
            I understand this approval applies to the controlled demo. It is not
            transport or identity certification.
          </span>
        </label>
        <Button
          busy={m.busy}
          disabled={!auth.online || !!d.data?.activeRideId}
          onClick={() => setSaveDraft(false)}
        >
          Submit for review
        </Button>
        <Button
          variant="secondary"
          busy={m.busy}
          disabled={!auth.online || !!d.data?.activeRideId}
          onClick={() => setSaveDraft(true)}
        >
          Save draft
        </Button>
        <Link className="text-link" href="/rider">
          Switch to passenger
        </Link>
      </form>
    </div>
  );
}
export function ApplicationStatus() {
  const d = useResource<Driver>("drivers/me", 10000);
  if (d.loading) return <Loading />;
  if (!d.data) return <Banner kind="error">{d.error}</Banner>;
  const driver = d.data;
  return (
    <div className="form-page">
      <Heading
        title={
          driver.approvalStatus === "approved"
            ? "You’re ready for the road."
            : driver.approvalStatus === "pending"
              ? "Your application is in review."
              : "Your driver application"
        }
        description="Track the review of your vehicle and driver profile."
      />
      <section className="panel">
        <Status value={driver.approvalStatus} />
        {driver.vehicle && (
          <div className="quote-amount">
            <div>
              <h3>
                {driver.vehicle.make} {driver.vehicle.model}
              </h3>
              <p>
                {driver.vehicle.color} · {driver.vehicle.plate}
              </p>
            </div>
            <CarFront size={32} />
          </div>
        )}
        {driver.reviewReason && (
          <Banner kind="warning">{driver.reviewReason}</Banner>
        )}
        <p className="compact-note">
          Only an administrator can approve an application. Your review status
          will update here.
        </p>
        <div className="action-stack">
          {driver.approvalStatus === "approved" ? (
            <Link className="button primary" href="/driver">
              Open driver dashboard
            </Link>
          ) : (
            driver.approvalStatus !== "suspended" && (
              <Link className="button primary" href="/driver/application">
                {driver.approvalStatus === "rejected"
                  ? "Edit and resubmit"
                  : "Edit application"}
              </Link>
            )
          )}
          <Button variant="secondary" onClick={d.refresh}>
            Refresh status
          </Button>
          <Link className="text-link" href="/driver/help">
            Get help
          </Link>
          <Link className="text-link" href="/rider">
            Switch to passenger
          </Link>
        </div>
      </section>
    </div>
  );
}
export function Earnings() {
  const [range, setRange] = useState("today"),
    [extra, setExtra] = useState<Ledger[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    m = useMutation(),
    p = useResource<
      Page<Ledger> & {
        totalPaise: number;
        pendingPaise: number;
      }
    >(`drivers/me/earnings?range=${range}`);
  async function more() {
    await m.run<Page<Ledger>>(
      `drivers/me/earnings?range=${range}&cursor=${encodeURIComponent(cursor ?? p.data!.nextCursor!)}`,
      undefined,
      (data) => {
        setExtra([...extra, ...data.items]);
        setCursor(data.nextCursor);
      },
      "GET",
    );
  }
  const rows = [...(p.data?.items ?? []), ...extra];
  return (
    <>
      <Heading
        title="A clear view of your earnings"
        description="Captured test payments only. These earnings are simulated, with no bank transfers."
      />
      <div className="tabs">
        {[
          ["today", "Today"],
          ["last7", "Last 7 days"],
          ["all", "All time"],
        ].map(([key, title]) => (
          <button
            key={key}
            className={range === key ? "active" : ""}
            onClick={() => {
              setRange(key);
              setExtra([]);
              setCursor(null);
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {p.loading ? (
        <Loading />
      ) : p.error ? (
        <Banner kind="error">
          {p.error}
          <Button onClick={p.refresh}>Retry</Button>
        </Banner>
      ) : (
        <>
          <div className="metric-grid">
            <div className="metric">
              <p>Captured test earnings</p>
              <strong>{money(p.data?.totalPaise ?? 0)}</strong>
              <small>80% of captured test fare</small>
            </div>
            <div className="metric">
              <p>Pending passenger payments</p>
              <strong>{money(p.data?.pendingPaise ?? 0)}</strong>
              <small>Excluded from captured earnings</small>
            </div>
          </div>
          <section className="workspace-section">
            {rows.length ? (
              <div className="ride-list">
                {rows.map((l) => (
                  <Link
                    key={l.id}
                    className="ride-row"
                    href={`/driver/rides/${l.rideId}`}
                  >
                    <IndianRupee size={22} />
                    <div className="ride-row-main">
                      <strong>Economy ride</strong>
                      <p>{date(l.capturedAt)}</p>
                    </div>
                    <div className="ride-row-side">
                      <strong>{money(l.driverSharePaise)}</strong>
                      <Status value="paid" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty icon={IndianRupee} title="No captured test earnings yet">
                Earnings appear after a passenger’s test payment is verified.
              </Empty>
            )}
          </section>
          {(extra.length ? cursor : p.data?.nextCursor) && (
            <div className="load-more">
              <Button variant="secondary" busy={m.busy} onClick={more}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
      {m.error && <Banner kind="error">{m.error}</Banner>}
    </>
  );
}
