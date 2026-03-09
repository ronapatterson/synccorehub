import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";
import * as React from "react";

type ReferralRewardEmailProps = {
  recipientName?: string;
  points: number;
  balance: number;
  portalUrl: string;
};

export function ReferralRewardEmail({ recipientName = "there", points, balance, portalUrl }: ReferralRewardEmailProps) {
  return (
    <Html><Head />
      <Preview>You earned {points} reward points!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 Reward earned!</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            Your referral was approved! You've earned <strong>{points} points</strong>.<br/>
            Your new balance is <strong>{balance} points</strong>.
          </Text>
          <Section style={btnSection}>
            <Button style={button} href={`${portalUrl}/referrals`}>View your rewards</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Keep referring friends to earn more rewards!</Text>
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
