"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CarFront,
  CreditCard,
  Briefcase,
  UserRound,
  MessageSquare,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  Heading,
  Button,
  Banner,
  Loading,
  Empty,
  Status,
  TextLink,
  Modal,
} from "@/components/ui";
import { useResource, useMutation } from "@/lib/hooks";
import {
  date,
  label,
  type Role,
  type Ticket,
  type Message,
  type Ride,
  type Page,
} from "@/contracts";
const categories = [
  {
    key: "ride",
    name: "Ride issue",
    icon: CarFront,
    description: "Questions about pickup, cancellation or your trip.",
  },
  {
    key: "payment",
    name: "Payment issue",
    icon: CreditCard,
    description: "Help with test checkout, payment status or a receipt.",
  },
  {
    key: "lost_item",
    name: "Lost item",
    icon: Briefcase,
    description: "Report something left behind on your journey.",
  },
  {
    key: "account",
    name: "Account issue",
    icon: UserRound,
    description: "Help with sign-in, profile or driver approval.",
  },
  {
    key: "other",
    name: "Something else",
    icon: MessageSquare,
    description: "Tell us what you need a hand with.",
  },
];
export function Help({ workspace }: { workspace: Role }) {
  return (
    <>
      <Heading
        title="A little help along the way."
        description="Choose a topic and tell us what happened."
        action={
          <Link
            className="button secondary"
            href={`/${workspace}/help/tickets`}
          >
            My requests
          </Link>
        }
      />
      <Banner>Support is not an emergency response service.</Banner>
      <div className="help-grid">
        {categories.map((c) => (
          <section className="help-card panel" key={c.key}>
            <c.icon size={26} strokeWidth={1.5} />
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <TextLink href={`/${workspace}/help/new?category=${c.key}`}>
              Create a request
            </TextLink>
          </section>
        ))}
      </div>
    </>
  );
}
export function NewTicket({ workspace }: { workspace: Role }) {
  const params = useSearchParams(),
    router = useRouter(),
    m = useMutation(),
    auth = useAuth(),
    rides = useResource<Page<Ride>>(
      `rides?role=${workspace === "admin" ? "rider" : workspace}`,
    ),
    [discard, setDiscard] = useState(false),
    [dirty, setDirty] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await m.run<{
      ticketId: string;
    }>("support/tickets", { ...b, rideId: b.rideId || null, workspace }, (r) =>
      router.push(`/${workspace}/help/tickets/${r.ticketId}`),
    );
  }
  return (
    <div className="form-page">
      <Heading
        title="Tell us what happened."
        description="Your request and replies stay in your support workspace."
      />
      {m.error && <Banner kind="error">{m.error}</Banner>}
      <form
        className="panel form-stack"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <div className="field">
          <label htmlFor="category">What can we help with?</label>
          <select
            id="category"
            name="category"
            defaultValue={params.get("category") ?? "ride"}
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            name="subject"
            required
            minLength={5}
            maxLength={100}
            placeholder="A short description of your issue"
          />
        </div>
        <div className="field">
          <label htmlFor="body">What happened?</label>
          <textarea
            id="body"
            name="body"
            required
            minLength={10}
            maxLength={2000}
            placeholder="Include the details that will help us understand."
          />
          <small>Please don’t include passwords or payment credentials.</small>
        </div>
        <div className="field">
          <label htmlFor="rideId">Related ride (optional)</label>
          <select
            id="rideId"
            name="rideId"
            defaultValue={params.get("ride") ?? ""}
          >
            <option value="">No related ride</option>
            {params.get("ride") &&
              !rides.data?.items.some((r) => r.id === params.get("ride")) && (
                <option value={params.get("ride")!}>
                  Ride {params.get("ride")}
                </option>
              )}
            {rides.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.pickup.label.split(",")[0]} to{" "}
                {r.destination.label.split(",")[0]}
              </option>
            ))}
          </select>
        </div>
        <Button busy={m.busy} disabled={!auth.online}>
          Submit request
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            dirty ? setDiscard(true) : router.push(`/${workspace}/help/tickets`)
          }
        >
          Cancel
        </Button>
      </form>
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard your request?"
        description="Your message has not been submitted."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDiscard(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            onClick={() => router.push(`/${workspace}/help/tickets`)}
          >
            Discard
          </Button>
        </div>
      </Modal>
    </div>
  );
}
export function Tickets({
  workspace,
  admin = false,
}: {
  workspace: Role;
  admin?: boolean;
}) {
  const [filter, setFilter] = useState("all"),
    [extra, setExtra] = useState<Ticket[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    m = useMutation(),
    path = `${admin ? "admin/support" : "support/tickets"}?status=${filter}`,
    r = useResource<Page<Ticket>>(path);
  async function more() {
    await m.run<Page<Ticket>>(
      `${path}&cursor=${encodeURIComponent(cursor ?? r.data!.nextCursor!)}`,
      undefined,
      (p) => {
        setExtra([...extra, ...p.items]);
        setCursor(p.nextCursor);
      },
      "GET",
    );
  }
  const rows = [...(r.data?.items ?? []), ...extra];
  return (
    <>
      <Heading
        title={admin ? "Support requests" : "Your support requests"}
        description={
          admin
            ? "Read, respond and resolve with a complete conversation."
            : "A record of your questions and the help you’ve received."
        }
        action={
          !admin && (
            <Link className="button primary" href={`/${workspace}/help/new`}>
              New request
            </Link>
          )
        }
      />
      <div className="tabs">
        {(admin
          ? ["all", "open", "in_progress", "resolved"]
          : ["all", "open", "resolved"]
        ).map((f) => (
          <button
            key={f}
            className={filter === f ? "active" : ""}
            onClick={() => {
              setFilter(f);
              setExtra([]);
              setCursor(null);
            }}
          >
            {label(f)}
          </button>
        ))}
      </div>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Banner kind="error">
          {r.error}
          <Button onClick={r.refresh}>Retry</Button>
        </Banner>
      ) : rows.length ? (
        rows.map((t) => (
          <Link
            className="ticket-row"
            key={t.id}
            href={
              admin
                ? `/admin/support/${t.id}`
                : `/${workspace}/help/tickets/${t.id}`
            }
          >
            <div>
              <h3>{t.subject}</h3>
              <p>
                {label(t.category)} · Updated {date(t.updatedAt)}
              </p>
            </div>
            <Status value={t.status} />
          </Link>
        ))
      ) : (
        <Empty
          icon={LifeBuoy}
          title={
            admin
              ? "No requests in this queue"
              : "You haven’t contacted support yet"
          }
          action={
            !admin && (
              <Link className="button primary" href={`/${workspace}/help/new`}>
                Create a request
              </Link>
            )
          }
        >
          {admin
            ? "New support requests will appear here."
            : "Create a request when you need help with a ride, payment or your account."}
        </Empty>
      )}
      {(extra.length ? cursor : r.data?.nextCursor) && (
        <div className="load-more">
          <Button variant="secondary" busy={m.busy} onClick={more}>
            Load more
          </Button>
        </div>
      )}
      {m.error && <Banner kind="error">{m.error}</Banner>}
    </>
  );
}
export function TicketThread({
  id,
  workspace,
  admin = false,
}: {
  id: string;
  workspace: Role;
  admin?: boolean;
}) {
  const auth = useAuth(),
    r = useResource<Ticket>(`support/tickets/${id}`, 15000),
    m = useMutation(),
    [body, setBody] = useState(""),
    [extra, setExtra] = useState<Message[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [target, setTarget] = useState<string | null>(null);
  const [paginationStarted, setPaginationStarted] = useState(false);
  async function more() {
    await m.run<Ticket>(
      `support/tickets/${id}?cursor=${encodeURIComponent(cursor ?? r.data!.nextCursor!)}`,
      undefined,
      (p) => {
        setPaginationStarted(true);
        setExtra([...extra, ...(p.messages ?? [])]);
        setCursor(p.nextCursor ?? null);
      },
      "GET",
    );
  }
  if (r.loading) return <Loading />;
  if (!r.data)
    return (
      <Banner kind="error">
        {r.error || "This support request is unavailable."}
      </Banner>
    );
  const ticket = r.data,
    messages = [
      ...new Map(
        [
          ...(ticket.messages ?? []),
          ...extra,
          ...(ticket.recentMessages ?? []),
        ].map((m) => [m.id, m]),
      ).values(),
    ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return (
    <div className="thread">
      <Link
        className="back-link"
        href={admin ? "/admin/support" : `/${workspace}/help/tickets`}
      >
        Back to requests
      </Link>
      <Heading
        title={ticket.subject}
        description={`${label(ticket.category)} · Created ${date(ticket.createdAt)}`}
        action={<Status value={ticket.status} />}
      />
      {ticket.rideId && (
        <TextLink href={`/${workspace}/rides/${ticket.rideId}`}>
          View associated ride
        </TextLink>
      )}
      {r.error && <Banner kind="warning">{r.error}</Banner>}
      <div className="messages">
        {messages.map((msg) => (
          <article
            className={`message ${msg.authorId === auth.user?.uid ? "mine" : ""}`}
            key={msg.id}
          >
            <div className="message-meta">
              <strong>
                {msg.authorId === "system"
                  ? "System"
                  : msg.authorRole === "admin"
                    ? "Support"
                    : msg.authorId === auth.user?.uid
                      ? "You"
                      : "Passenger / driver"}
              </strong>
              <span>{date(msg.createdAt)}</span>
            </div>
            <p>{msg.body}</p>
          </article>
        ))}
      </div>
      {(paginationStarted ? cursor : ticket.nextCursor) && (
        <Button variant="secondary" busy={m.busy} onClick={more}>
          Load more messages
        </Button>
      )}
      {m.error && <Banner kind="error">{m.error}</Banner>}
      {ticket.status === "resolved" ? (
        <div className="notice-panel">
          <h3>This request is resolved.</h3>
          <p>Need more help with the same issue? Reopen the conversation.</p>
          <Button variant="secondary" onClick={() => setTarget("open")}>
            Reopen request
          </Button>
        </div>
      ) : (
        <form
          className="reply-form"
          onSubmit={(e) => {
            e.preventDefault();
            void m.run<{ message: Message }>(
              `support/tickets/${id}/messages`,
              { body },
              async (result) => {
                setBody("");
                setExtra((previous) => [...previous, result.message]);
                await r.refresh();
              },
            );
          }}
        >
          <div className="field">
            <label htmlFor="reply">
              {admin ? "Your response" : "Your reply"}
            </label>
            <textarea
              id="reply"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={1}
              maxLength={2000}
            />
          </div>
          <Button busy={m.busy} disabled={!body.trim() || !auth.online}>
            {admin ? "Send response" : "Send reply"}
          </Button>
        </form>
      )}
      {admin && ticket.status !== "resolved" && (
        <div className="switch-links">
          <Button variant="secondary" onClick={() => setTarget("in_progress")}>
            Mark in progress
          </Button>
          <Button
            variant="secondary"
            disabled={!ticket.hasAdminReply}
            onClick={() => setTarget("resolved")}
          >
            Resolve request
          </Button>
        </div>
      )}
      <Modal
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Mark request ${label(target ?? "open").toLowerCase()}?`}
        description="The conversation will remain available in the request history."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button
            busy={m.busy}
            onClick={() =>
              m.run(
                `support/tickets/${id}/status`,
                { target, expectedVersion: ticket.version },
                async () => {
                  setTarget(null);
                  await r.refresh();
                },
              )
            }
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
