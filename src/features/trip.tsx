"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { money, date, type Ride, type Role } from "@/contracts";
import { api, useAuth } from "@/components/auth-provider";
import { CityMap } from "@/components/map-loader";
import {
  Heading,
  Button,
  Banner,
  Loading,
  Endpoints,
  Steps,
  Status,
  Modal,
} from "@/components/ui";
import { useMutation, useResource } from "@/lib/hooks";
import { useTracking } from "@/lib/location";
import { useDriverLocation } from "@/components/location-provider";
import { canCancel, terminal } from "@/lib/domain";
export function Trip({ id, workspace }: { id: string; workspace: Role }) {
  const auth = useAuth(),
    r = useResource<Ride>(`rides/${id}`, 10000),
    m = useMutation(),
    tracking = useTracking(
      r.data && ["assigned", "arrived", "in_progress"].includes(r.data.status)
        ? id
        : null,
    ),
    ownGps = useDriverLocation();
  const [confirm, setConfirm] = useState<string | null>(null),
    [reason, setReason] = useState("plans_changed"),
    [note, setNote] = useState(""),
    [pin, setPin] = useState(""),
    [ownPin, setOwnPin] = useState(""),
    [showPin, setShowPin] = useState(false),
    [clock, setClock] = useState(() => Date.now());
  const stopGps = ownGps.stop;
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (r.data?.status === "completed" || r.data?.status === "cancelled")
      stopGps();
  }, [r.data?.status, stopGps]);
  if (r.loading) return <Loading />;
  if (!r.data)
    return (
      <>
        <Banner kind="error">{r.error || "This ride is unavailable."}</Banner>
        <Button onClick={r.refresh}>Retry</Button>
      </>
    );
  const ride = r.data,
    isDriver = workspace === "driver",
    expired =
      ride.status === "searching" && clock > Date.parse(ride.searchExpiresAt),
    status = expired ? "expired" : ride.status,
    location = tracking.location ?? ownGps.location;
  const title = {
    searching: "Finding your driver.",
    assigned: isDriver
      ? "Your passenger is waiting."
      : "Your driver is on the way.",
    arrived: isDriver ? "Ready when they are." : "Your driver has arrived.",
    in_progress: "Enjoy the journey.",
    completed: "You’ve arrived.",
    cancelled: "Ride cancelled.",
    expired: "No driver accepted.",
  }[status];
  async function mutate(action: string) {
    const result = await m.run(
      `rides/${id}/${action}`,
      {
        expectedVersion: ride.version,
        ...(action === "start" ? { pin } : {}),
        ...(action === "cancel"
          ? {
              reason:
                isDriver && reason === "plans_changed"
                  ? "vehicle_issue"
                  : reason,
              note,
            }
          : {}),
      },
      async () => {
        setConfirm(null);
        setPin("");
        await r.refresh();
        await auth.refresh();
      },
    );
    if (!result && action === "start") setPin("");
    if (!result) await r.refresh();
  }
  async function loadPin() {
    if (showPin) {
      setShowPin(false);
      return;
    }
    try {
      const data = await api<{
        pin: string;
      }>(`rides/${id}/pin`);
      setOwnPin(data.pin);
      setShowPin(true);
    } catch (e) {
      m.setError(e instanceof Error ? e.message : "PIN unavailable.");
    }
  }
  return (
    <>
      <Heading
        title={title}
        description={
          status === "searching"
            ? `Your request is saved. Waiting for a driver to accept (${Math.max(0, Math.ceil((Date.parse(ride.searchExpiresAt) - clock) / 1000))}s).`
            : status === "in_progress"
              ? "Your fixed fare stays the same for this journey."
              : status === "completed"
                ? `Completed ${ride.completedAt ? date(ride.completedAt) : ""}`
                : undefined
        }
      />
      {r.error && (
        <Banner kind="warning">
          {r.error}{" "}
          <Button variant="ghost" onClick={r.refresh}>
            Refresh
          </Button>
        </Banner>
      )}
      {m.error && (
        <Banner kind="error">
          {m.error}
          <small>Request {m.requestId}</small>
        </Banner>
      )}
      {ride.trackingMode === "simulation" && (
        <Banner kind="info">
          Simulated driver location — controlled demonstration.
        </Banner>
      )}
      <div className="ride-layout">
        <section className="panel">
          <div className="row-between">
            <h2 style={{ fontSize: 21 }}>Safar Economy</h2>
            <Status value={status} />
          </div>
          {!terminal(status) && <Steps status={status} />}
          <Endpoints
            pickup={ride.pickup.label}
            destination={ride.destination.label}
          />
          {ride.driverSnapshot && (
            <div className="driver-card">
              <span className="avatar">
                {isDriver
                  ? ride.riderSnapshot.initials
                  : ride.driverSnapshot.initials}
              </span>
              <div>
                <strong>
                  {isDriver
                    ? ride.riderSnapshot.displayName
                    : ride.driverSnapshot.displayName}
                </strong>
                <p>
                  {!isDriver &&
                    (ride.driverRating
                      ? `${ride.driverRating.toFixed(1)} rating`
                      : "New driver")}
                </p>
                <p>
                  {ride.vehicleSnapshot?.color} {ride.vehicleSnapshot?.make}{" "}
                  {ride.vehicleSnapshot?.model}
                </p>
              </div>
              <span className="plate">{ride.vehicleSnapshot?.plate}</span>
            </div>
          )}
          <div className="quote-amount">
            <div>
              <p>Fixed fare</p>
              <small className="muted">
                {(ride.distanceMeters / 1000).toFixed(1)} km · About{" "}
                {Math.round(ride.durationSeconds / 60)} min
              </small>
            </div>
            <strong>{money(ride.fare.totalPaise)}</strong>
          </div>
          {!isDriver && ["assigned", "arrived"].includes(status) && (
            <div className="pin-card">
              <div className="row-between">
                <strong>Your trip PIN</strong>
                <Button variant="ghost" onClick={loadPin}>
                  {showPin ? "Hide" : "Show PIN"}
                </Button>
              </div>
              {showPin && (
                <div className="pin" aria-label="Trip PIN">
                  {ownPin}
                </div>
              )}
              <p>Share this PIN only when you’re ready to start.</p>
            </div>
          )}
          {isDriver && status === "arrived" && (
            <div className="field">
              <label htmlFor="trip-pin">Passenger’s trip PIN</label>
              <input
                id="trip-pin"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <small>Ask the passenger for their PIN once seated.</small>
            </div>
          )}
          {["assigned", "arrived", "in_progress"].includes(status) && (
            <>
              <p className="gps-age">
                {location
                  ? clock - location.timestamp > 60000
                    ? "Tracking unavailable — location is over a minute old."
                    : `Location last updated ${Math.max(0, Math.round((clock - location.timestamp) / 1000))} seconds ago`
                  : "Waiting for a fresh driver location."}
              </p>
              {tracking.error && (
                <Banner kind="warning">{tracking.error}</Banner>
              )}
              {ride.accessSyncPending && (
                <Banner kind="warning">
                  Ride accepted. Connecting tracking…
                </Banner>
              )}
            </>
          )}
          <div className="action-stack">
            {isDriver && status === "assigned" && (
              <Button
                busy={m.busy}
                disabled={!auth.online}
                onClick={() => setConfirm("arrive")}
              >
                I’ve arrived
              </Button>
            )}
            {isDriver && status === "arrived" && (
              <Button
                busy={m.busy}
                disabled={pin.length !== 4 || !auth.online}
                onClick={() => mutate("start")}
              >
                Start ride
              </Button>
            )}
            {isDriver && status === "in_progress" && (
              <Button
                disabled={!auth.online}
                onClick={() => setConfirm("complete")}
              >
                Complete ride
              </Button>
            )}
            {canCancel(status) && (
              <Button
                variant="secondary"
                disabled={!auth.online}
                onClick={() => setConfirm("cancel")}
              >
                Cancel ride
              </Button>
            )}
            {status === "completed" && (
              <>
                <Status value={ride.paymentStatus} />
                {!isDriver &&
                  (ride.payment?.capturedPaymentId ? (
                    <Link
                      className="button primary"
                      href={`/rider/rides/${id}/receipt`}
                    >
                      View receipt
                    </Link>
                  ) : (
                    <Link
                      className="button primary"
                      href={`/rider/rides/${id}/payment`}
                    >
                      {ride.paymentStatus === "review_required"
                        ? "Check payment status"
                        : `Pay ${money(ride.fare.totalPaise)}`}
                    </Link>
                  ))}
                {!isDriver && (
                  <Link
                    className="button secondary"
                    href={`/rider/rides/${id}/rate`}
                  >
                    {ride.reviewId ? "View my rating" : "Rate driver"}
                  </Link>
                )}
                {isDriver && (
                  <p className="compact-note">
                    {ride.payment?.capturedPaymentId
                      ? `Captured test earnings: ${money(ride.payment.driverSharePaise)}`
                      : "Passenger payment pending. Earnings appear after capture."}
                  </p>
                )}
              </>
            )}
            {["cancelled", "expired"].includes(status) && (
              <>
                <p className="compact-note">
                  {status === "cancelled"
                    ? `${ride.cancelledByRole === "driver" ? "Driver" : "Passenger"} cancelled: ${ride.cancellationReason?.replaceAll("_", " ") ?? ""}. `
                    : ""}
                  No charge for this request.
                </p>
                <Link
                  className="button primary"
                  href={`/${isDriver ? "driver" : "rider"}`}
                >
                  {isDriver ? "Back to dashboard" : "Book again"}
                </Link>
              </>
            )}
            <Link
              className="text-link"
              href={`/${isDriver ? "driver" : workspace}/help/new?ride=${id}`}
            >
              Get help
            </Link>
            {["assigned", "arrived", "in_progress"].includes(status) && (
              <Button variant="ghost" onClick={r.refresh}>
                Refresh tracking
              </Button>
            )}
          </div>
          {isDriver && !terminal(status) && (
            <>
              <p className="compact-note">
                Keep this page open for foreground location sharing. Interact
                only while safely stationary.
              </p>
              {ownGps.error && <Banner kind="warning">{ownGps.error}</Banner>}
              <Button
                variant="secondary"
                onClick={() =>
                  ownGps.start(false).catch((e) => ownGps.setError(e.message))
                }
              >
                {ownGps.tracking ? "Refresh GPS" : "Resume GPS sharing"}
              </Button>
              {auth.driver?.simulationAllowed && (
                <div className="notice-panel">
                  <strong>Controlled simulation</strong>
                  <div className="action-stack">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        ownGps
                          .start(true)
                          .catch((e) => ownGps.setError(e.message))
                      }
                    >
                      Use demo location
                    </Button>
                    {ownGps.tracking && ownGps.simulation && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const p = ride.routeGeometry?.coordinates ?? [];
                          const last =
                            p[
                              Math.min(
                                Math.max(1, Math.floor(p.length / 2)),
                                p.length - 1,
                              )
                            ];
                          if (last) ownGps.move(last[1], last[0]);
                        }}
                      >
                        Move along route
                      </Button>
                    )}
                    <Button variant="ghost" onClick={ownGps.stop}>
                      Stop simulation
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        <div className="booking-map">
          <CityMap
            pickup={ride.pickup}
            destination={ride.destination}
            geometry={ride.routeGeometry?.coordinates}
            location={location}
          />
        </div>
      </div>
      <Modal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "cancel"
            ? "Cancel this ride?"
            : confirm === "arrive"
              ? "Confirm arrival?"
              : "Complete this ride?"
        }
        description={
          confirm === "cancel"
            ? "There is no cancellation fee. This ends the request."
            : confirm === "arrive"
              ? "Confirm you are at the pickup point. Please act while stationary."
              : `Confirm the passenger has reached the destination. The agreed test fare is ${money(ride.fare.totalPaise)}.`
        }
      >
        {confirm === "cancel" && (
          <div className="form-stack">
            <div className="field">
              <label htmlFor="reason">Reason</label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {(isDriver
                  ? ["vehicle_issue", "cannot_reach_pickup", "other"]
                  : [
                      "plans_changed",
                      "wrong_location",
                      "taking_too_long",
                      "other",
                    ]
                ).map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="note">
                Additional details{" "}
                {isDriver && reason === "other" ? "(required)" : "(optional)"}
              </label>
              <textarea
                id="note"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}
        {m.error && <Banner kind="error">{m.error}</Banner>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            {confirm === "cancel"
              ? "Keep ride"
              : confirm === "arrive"
                ? "Not yet"
                : "Keep driving"}
          </Button>
          <Button
            variant={confirm === "cancel" ? "danger" : "primary"}
            busy={m.busy}
            disabled={!auth.online}
            onClick={() => mutate(confirm!)}
          >
            {confirm === "cancel"
              ? "Confirm cancellation"
              : confirm === "arrive"
                ? "Confirm arrival"
                : "Confirm completion"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
