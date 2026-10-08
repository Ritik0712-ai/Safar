import "server-only";
import { z } from "zod";
import type { Query } from "firebase-admin/firestore";
import { admin } from "@/lib/firebase/admin";
import {
  ticketSchema,
  versionSchema,
  type Ticket,
  type Message,
} from "@/contracts";
import {
  base,
  updated,
  atomic,
  ensure,
  checkVersion,
  now,
  dto,
  page,
  audit,
  type Actor,
  type Operation,
} from "@/server/core";
import { authorizeRide } from "./rides";
export async function createTicket(op: Operation) {
  const b = ticketSchema.parse(op.body),
    a = op.actor;
  ensure(
    a.account?.roles.includes(b.workspace),
    403,
    "WORKSPACE_UNAVAILABLE",
    "This workspace is unavailable.",
  );
  if (b.rideId) await authorizeRide(a, b.rideId);
  const ref = admin().db.collection("supportTickets").doc();
  return atomic(op, async (t) => {
    t.create(ref, {
      ...base(),
      ownerId: a.uid,
      ownerWorkspace: b.workspace,
      rideId: b.rideId,
      category: b.category,
      subject: b.subject,
      status: "open",
      lastMessageAt: now(),
      lastMessageBy: a.uid,
      hasAdminReply: false,
      isDemo: a.account!.isDemo,
    });
    const messageRef = ref.collection("messages").doc(),
      stamp = now();
    t.create(messageRef, {
      schemaVersion: 1,
      createdAt: stamp,
      ticketId: ref.id,
      authorId: a.uid,
      authorRole: b.workspace,
      body: b.body,
      requestId: op.key,
    });
    return { ticketId: ref.id };
  });
}
export async function getTicket(
  a: Actor,
  id: string,
  cursor: string | null = null,
) {
  const doc = await admin().db.doc(`supportTickets/${id}`).get();
  ensure(
    doc.exists && (doc.data()?.ownerId === a.uid || a.admin),
    404,
    "NOT_FOUND",
    "This support request is unavailable.",
  );
  const messages = await page<Message>(
    doc.ref.collection("messages"),
    `${a.uid}:ticket:${id}`,
    cursor,
    "createdAt",
    true,
  );
  const recent = await doc.ref
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  return {
    ...dto<Ticket>(doc),
    messages: messages.items,
    recentMessages: recent.docs.map((d) => dto<Message>(d)),
    nextCursor: messages.nextCursor,
  };
}
export async function listTickets(
  a: Actor,
  status: string | null,
  cursor: string | null,
  all = false,
) {
  ensure(
    !all || a.admin,
    403,
    "WORKSPACE_UNAVAILABLE",
    "Administrator access is required.",
  );
  let q: Query = all
    ? admin().db.collection("supportTickets")
    : admin().db.collection("supportTickets").where("ownerId", "==", a.uid);
  if (status && status !== "all")
    q = q.where(
      "status",
      "==",
      z.enum(["open", "in_progress", "resolved"]).parse(status),
    );
  return page<Ticket>(
    q,
    `${a.uid}:tickets:${all}:${status}`,
    cursor,
    "updatedAt",
  );
}
export async function message(op: Operation, id: string) {
  const b = z
      .object({ body: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(op.body),
    a = op.actor;
  return atomic(op, async (t) => {
    const ref = admin().db.doc(`supportTickets/${id}`),
      doc = await t.get(ref),
      ticket = dto<Ticket>(doc);
    ensure(
      ticket.ownerId === a.uid || a.admin,
      404,
      "NOT_FOUND",
      "This support request is unavailable.",
    );
    ensure(
      ticket.status !== "resolved",
      409,
      "TICKET_RESOLVED",
      "Reopen this request before replying.",
    );
    const messageRef = ref.collection("messages").doc(),
      stamp = now(),
      authorRole = a.admin ? "admin" : ticket.ownerWorkspace;
    t.create(messageRef, {
      schemaVersion: 1,
      createdAt: stamp,
      ticketId: id,
      authorId: a.uid,
      authorRole,
      body: b.body,
      requestId: op.key,
    });
    t.update(ref, {
      ...updated(ticket.version),
      lastMessageAt: now(),
      lastMessageBy: a.uid,
      hasAdminReply: ticket.hasAdminReply || a.admin,
      status: a.admin ? "in_progress" : ticket.status,
    });
    return {
      sent: true,
      message: {
        id: messageRef.id,
        body: b.body,
        authorId: a.uid,
        authorRole,
        createdAt: stamp.toDate().toISOString(),
      },
    };
  });
}
export async function ticketStatus(op: Operation, id: string) {
  const b = versionSchema
      .extend({ target: z.enum(["open", "in_progress", "resolved"]) })
      .strict()
      .parse(op.body),
    a = op.actor;
  return atomic(op, async (t) => {
    const ref = admin().db.doc(`supportTickets/${id}`),
      doc = await t.get(ref),
      ticket = dto<Ticket>(doc);
    ensure(
      ticket.ownerId === a.uid || a.admin,
      404,
      "NOT_FOUND",
      "This support request is unavailable.",
    );
    checkVersion(ticket, b.expectedVersion);
    ensure(
      a.admin || (ticket.status === "resolved" && b.target === "open"),
      403,
      "ADMIN_REQUIRED",
      "Only support can change this status.",
    );
    ensure(
      b.target !== "resolved" || ticket.hasAdminReply,
      422,
      "REPLY_REQUIRED",
      "Send a support response before resolving.",
    );
    t.update(ref, {
      ...updated(ticket.version),
      status: b.target,
      ...(b.target === "resolved"
        ? { resolvedAt: now(), resolvedBy: a.uid }
        : {}),
    });
    audit(t, a, "ticket_status", id, ticket.status, b.target);
    return { status: b.target };
  });
}
