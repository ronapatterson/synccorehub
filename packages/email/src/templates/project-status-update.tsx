import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";

type ProjectStatusUpdateEmailProps = {
  customerName?: string;
  projectName: string;
  newStatus: string;
  message?: string;
  portalUrl: string;
};

export function ProjectStatusUpdateEmail({ customerName = "there", projectName, newStatus, message, portalUrl }: ProjectStatusUpdateEmailProps) {
  return (
    <Html><Head />
      <Preview>Project update: {projectName} is now {newStatus}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Project update</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Your project <strong>{projectName}</strong> has been updated to <strong>{newStatus}</strong>.
          </Text>
          {message && <Text style={text}>{message}</Text>}
          <Section style={btnSection}>
            <Button style={button} href={portalUrl}>View project details</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>You're receiving this because you have access to this project. Visit your portal to manage notifications.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "40px", maxWidth: "560px" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" };
const text = { color: "#444", fontSize: "15px", lineHeight: "1.6" };
const footer = { color: "#999", fontSize: "12px" };
const btnSection = { textAlign: "center" as const, margin: "24px 0" };
const button = { backgroundColor: "#6366f1", borderRadius: "6px", color: "#fff", fontSize: "15px", fontWeight: "bold", padding: "12px 24px", textDecoration: "none", display: "inline-block" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
