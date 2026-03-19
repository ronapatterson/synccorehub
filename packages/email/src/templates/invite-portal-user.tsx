import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type InvitePortalUserEmailProps = {
  inviteeName?: string;
  tenantName: string;
  portalUrl: string;
  inviteToken: string;
};

export function InvitePortalUserEmail({
  inviteeName = "there",
  tenantName,
  portalUrl,
  inviteToken,
}: InvitePortalUserEmailProps) {
  const inviteLink = `${portalUrl}/auth/accept-invite?token=${inviteToken}`;

  return (
    <Html>
      <Head />
      <Preview>You've been invited to {tenantName}'s client portal</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're invited!</Heading>
          <Text style={text}>
            Hi {inviteeName}, {tenantName} has invited you to their client portal, where you can
            track project progress, view milestones, and discover new services.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={inviteLink}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={smallText}>
            Or copy this link: <Link href={inviteLink}>{inviteLink}</Link>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            This invitation expires in 7 days. If you weren't expecting this, ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px", maxWidth: "560px" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" };
const text = { color: "#444", fontSize: "15px", lineHeight: "1.6" };
const smallText = { color: "#888", fontSize: "13px" };
const footer = { color: "#999", fontSize: "12px" };
const buttonSection = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#6366f1",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "bold",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
