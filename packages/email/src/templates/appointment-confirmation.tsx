import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

type AppointmentConfirmationEmailProps = {
  recipientName?: string;
  callerName: string | null;
  callerPhone: string;
  scheduledAt: string; // Human-readable, e.g. "Tuesday, March 15, 2026 at 2:30 PM EST"
  appointmentId: string;
};

export function AppointmentConfirmationEmail({
  recipientName = "there",
  callerName,
  callerPhone,
  scheduledAt,
  appointmentId,
}: AppointmentConfirmationEmailProps) {
  const callerDisplay = callerName ?? callerPhone;

  return (
    <Html>
      <Head />
      <Preview>
        Appointment confirmed: {callerDisplay} on {scheduledAt}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>📅 Appointment confirmed</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            <strong>{callerDisplay}</strong> has scheduled a callback with you.
          </Text>

          <Section style={detailsBox}>
            <Text style={detailRow}>
              <strong>When:</strong> {scheduledAt}
            </Text>
            <Text style={detailRow}>
              <strong>Caller:</strong> {callerDisplay}
            </Text>
            <Text style={detailRow}>
              <strong>Call back to:</strong> {callerPhone}
            </Text>
          </Section>

          <Text style={text}>
            This appointment has been logged in your CRM as a scheduled meeting.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Appointment ID: {appointmentId} · Powered by SyncCoreHub
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = {
  backgroundColor: "#fff",
  margin: "0 auto",
  padding: "40px",
  maxWidth: "560px",
  borderRadius: "8px",
};
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold", marginBottom: "8px" };
const text = { color: "#444", fontSize: "15px", lineHeight: "1.6" };
const detailsBox = {
  backgroundColor: "#f8faff",
  border: "1px solid #e0e7ff",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};
const detailRow = { color: "#444", fontSize: "14px", lineHeight: "1.8", margin: "0" };
const footer = { color: "#999", fontSize: "12px" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
