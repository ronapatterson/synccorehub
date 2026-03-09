"use client";
/**
 * Portal auth client — used in apps/portal React components
 */
import { createAuthClient } from "better-auth/react";

export const portalAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001",
});

export const {
  signIn: portalSignIn,
  signOut: portalSignOut,
  signUp: portalSignUp,
  useSession: usePortalSession,
} = portalAuthClient;
