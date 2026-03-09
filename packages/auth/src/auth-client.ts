"use client";
/**
 * Business auth client — used in apps/web React components
 */
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [
    organizationClient(),
    twoFactorClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  organization,
} = authClient;

export type { Session } from "./auth";
