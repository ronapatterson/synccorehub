/**
 * Public Scheduling Page
 *
 * Token-gated. No authentication required.
 * Callers land here after receiving an SMS from the IVR.
 */
import { notFound } from "next/navigation";
import { db } from "@synccorehub/database/client";
import {
  schedulingSessions,
  callRoutingNumbers,
  user,
} from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";
import { SchedulingUI } from "./_components/scheduling-ui";

interface SchedulingPageProps {
  params: Promise<{ token: string }>;
}

async function getSessionData(token: string) {
  const [row] = await db
    .select({
      session: schedulingSessions,
      number: {
        id: callRoutingNumbers.id,
        availabilityConfig: callRoutingNumbers.availabilityConfig,
      },
      recipientId: callRoutingNumbers.userId,
    })
    .from(schedulingSessions)
    .innerJoin(
      callRoutingNumbers,
      eq(schedulingSessions.virtualNumberId, callRoutingNumbers.id)
    )
    .where(eq(schedulingSessions.token, token))
    .limit(1);

  if (!row) return null;

  // Fetch recipient name for display
  const [recipient] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, row.recipientId))
    .limit(1);

  return { ...row, recipientName: recipient?.name ?? null };
}

export default async function SchedulingPage({ params }: SchedulingPageProps) {
  const { token } = await params;
  const data = await getSessionData(token);

  if (!data) {
    notFound();
  }

  const { session } = data;
  const now = new Date();

  if (new Date(session.expiresAt) < now) {
    return (
      <SchedulingLayout>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link expired</h1>
          <p className="text-gray-500">
            This scheduling link has expired. Please call back to receive a new link.
          </p>
        </div>
      </SchedulingLayout>
    );
  }

  if (session.status === "scheduled") {
    return (
      <SchedulingLayout>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already scheduled</h1>
          <p className="text-gray-500">
            Your appointment has already been booked. Check your phone for confirmation details.
          </p>
        </div>
      </SchedulingLayout>
    );
  }

  return (
    <SchedulingLayout>
      <SchedulingUI
        token={token}
        sessionId={session.id}
        callerName={session.callerName ?? undefined}
        callerPhone={session.callerPhone}
        recipientName={data.recipientName ?? "your contact"}
        slots={session.availableSlotsSnapshot ?? []}
      />
    </SchedulingLayout>
  );
}

function SchedulingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
            Powered by SyncCoreHub
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}
