import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr, Link,
} from "@react-email/components";
import * as React from "react";

type TeamInvitationEmailProps = {
  inviteeName?: string;
  inviterName: string;
  orgName: string;
  role: string;
  inviteUrl: string;
};

export function TeamInvitationEmail({ inviteeName = "there", inviterName, orgName, role, inviteUrl }: TeamInvitationEmailProps) {
  return (
    <Html><Head />
      <Preview>{inviterName} invited you to join {orgName} on SyncCoreHub</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Team invitation</Heading>
          <Text style={text}>
            Hi {inviteeName}, {inviterName} has invited you to join <strong>{orgName}</strong> on SyncCoreHub as a <strong>{role}</strong>.
          </Text>
          <Section style={btnSection}>
            <Button style={button} href={inviteUrl}>Accept invitation</Button>
          </Section>
          <Text style={small}>Or copy: <Link href={inviteUrl}>{inviteUrl}</Link></Text>
          <Hr style={hr} />
          <Text style={footer}>This invitation expires in 48 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "40px", maxWidth: "560px" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" };
const text = { color: "#444", fontSize: "15px", lineHeight: "1.6" };
const small = { color: "#888", fontSize: "13px" };
const footer = { color: "#999", fontSize: "12px" };
const btnSection = { textAlign: "center" as const, margin: "24px 0" };
const button = { backgroundColor: "#6366f1", borderRadius: "6px", color: "#fff", fontSize: "15px", fontWeight: "bold", padding: "12px 24px", textDecoration: "none", display: "inline-block" };
const hr = { borderColor: "#e2e8f0", margin: "24px 0" };
