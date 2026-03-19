/**
 * Public booking confirmation API.
 * Called by the scheduling page when a caller selects a slot.
 * No authentication required — access is controlled by the token.
 */
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@synccorehub/database/client";
import {
  schedulingSessions,
  scheduledAppointments,
  callRoutingNumbers,
  missedCallLogs,
} from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";
import type { SlotSnapshot } from "@synccorehub/database/schema";
import Redis from "ioredis";
import { type ConnectionOptions } from "bullmq";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function enqueueAppointmentConfirmation(data: {
  tenantId: string;
  appointmentId: string;
  scheduledAt: string;
  recipientUserId: string;
  callerPhone: string;
  callerName: string | null;
}) {
  const { Queue } = await import("bullmq");
  const queue = new Queue("appointment-confirmation", { connection: redis as unknown as ConnectionOptions });
  await queue.add("send-appointment-confirmation", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  });
  await queue.close();
}

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  let body: { slotIso: string; callerName?: string; callerPhone: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slotIso, callerName, callerPhone } = body;

  if (!slotIso || !callerPhone) {
    return NextResponse.json({ error: "Missing slotIso or callerPhone" }, { status: 400 });
  }

  // Fetch the session
  const [row] = await db
    .select({
      session: schedulingSessions,
      number: callRoutingNumbers,
    })
    .from(schedulingSessions)
    .innerJoin(
      callRoutingNumbers,
      eq(schedulingSessions.virtualNumberId, callRoutingNumbers.id)
    )
    .where(eq(schedulingSessions.token, token))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const { session, number } = row;

  // Validate expiry
  if (new Date(session.expiresAt) < new Date()) {
    return NextResponse.json({ error: "This scheduling link has expired." }, { status: 410 });
  }

  // Validate session status
  if (session.status === "scheduled") {
    return NextResponse.json({ error: "This slot has already been booked." }, { status: 409 });
  }

  // Validate the slot exists in the snapshot
  const snapshot = (session.availableSlotsSnapshot ?? []) as SlotSnapshot[];
  const daySnapshot = snapshot.find((d) => {
    // Compare dates — the snapshot date is in recipient's local TZ
    const daySlots = d.slots;
    return daySlots.includes(slotIso);
  });

  if (!daySnapshot) {
    return NextResponse.json(
      { error: "Selected slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  // Create the appointment
  const [appointment] = await db
    .insert(scheduledAppointments)
    .values({
      tenantId: session.tenantId,
      schedulingSessionId: session.id,
      virtualNumberId: session.virtualNumberId,
      recipientUserId: number.userId,
      callerPhone,
      callerName: callerName ?? session.callerName ?? null,
      scheduledAt: new Date(slotIso),
      durationMinutes: String(number.availabilityConfig?.slotDurationMinutes ?? 30),
      status: "confirmed",
      confirmedAt: new Date(),
    })
    .returning();

  if (!appointment) {
    return NextResponse.json({ error: "Failed to create appointment." }, { status: 500 });
  }

  // Update session status
  await db
    .update(schedulingSessions)
    .set({ status: "scheduled", updatedAt: new Date() })
    .where(eq(schedulingSessions.id, session.id));

  // Update missed call log
  if (session.missedCallLogId) {
    await db
      .update(missedCallLogs)
      .set({ status: "scheduled", schedulingSessionId: session.id })
      .where(eq(missedCallLogs.id, session.missedCallLogId));
  }

  // Enqueue confirmation jobs
  await enqueueAppointmentConfirmation({
    tenantId: session.tenantId,
    appointmentId: appointment.id,
    scheduledAt: new Date(slotIso).toISOString(),
    recipientUserId: number.userId,
    callerPhone,
    callerName: callerName ?? session.callerName ?? null,
  });

  return NextResponse.json({ success: true, appointmentId: appointment.id });
}
