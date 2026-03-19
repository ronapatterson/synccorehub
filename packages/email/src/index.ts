import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@synccorehub.com";

export async function sendEmail({
  to,
  subject,
  react,
  text,
}: {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  text?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
    text,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

export * from "./templates/invite-portal-user";
export * from "./templates/team-invitation";
export * from "./templates/project-status-update";
export * from "./templates/referral-reward";
export * from "./templates/appointment-confirmation";
