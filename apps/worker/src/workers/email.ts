import { Worker } from "bullmq";
import { connection } from "../queues/index.js";
import { sendEmail } from "@synccorehub/email";
import {
  InvitePortalUserEmail,
  TeamInvitationEmail,
  ProjectStatusUpdateEmail,
  ReferralRewardEmail,
} from "@synccorehub/email/templates";
import * as React from "react";

export interface EmailJobData {
  type: "invite-portal-user" | "team-invitation" | "project-status-update" | "referral-reward";
  to: string;
  subject: string;
  props: Record<string, unknown>;
}

function buildEmailComponent(data: EmailJobData): React.ReactElement {
  switch (data.type) {
    case "invite-portal-user":
      return React.createElement(InvitePortalUserEmail, data.props as Parameters<typeof InvitePortalUserEmail>[0]);
    case "team-invitation":
      return React.createElement(TeamInvitationEmail, data.props as Parameters<typeof TeamInvitationEmail>[0]);
    case "project-status-update":
      return React.createElement(ProjectStatusUpdateEmail, data.props as Parameters<typeof ProjectStatusUpdateEmail>[0]);
    case "referral-reward":
      return React.createElement(ReferralRewardEmail, data.props as Parameters<typeof ReferralRewardEmail>[0]);
    default:
      throw new Error(`Unknown email type: ${(data as EmailJobData).type}`);
  }
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobData>(
    "email",
    async (job) => {
      const { data } = job;
      console.log(`[email-worker] Processing ${data.type} → ${data.to}`);

      const react = buildEmailComponent(data);

      await sendEmail({
        to: data.to,
        subject: data.subject,
        react,
      });

      console.log(`[email-worker] Sent ${data.type} → ${data.to}`);
    },
    {
      connection,
      concurrency: 5,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[email-worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[email-worker] Worker error:", err.message);
  });

  return worker;
}
