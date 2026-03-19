# Smart Call Routing Plugin — Next Steps

All code has been implemented. Follow these steps to get the plugin running.

---

## 1. Run Database Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

This creates the 4 new tables:
- `call_routing_numbers`
- `missed_call_logs`
- `scheduling_sessions`
- `scheduled_appointments`

---

## 2. Seed the Plugin Registry

```bash
pnpm db:seed
```

This registers `smart-call-routing` in the `plugins` table so it appears in the marketplace.

---

## 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the following new variables:

```bash
# Twilio — get these from console.twilio.com
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_MESSAGING_SERVICE_SID="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Google Calendar OAuth — console.cloud.google.com
# (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET already set for auth, reused here)
GOOGLE_REDIRECT_URI="https://your-domain.com/api/integrations/google-calendar/callback"

# Microsoft Calendar OAuth — portal.azure.com → App registrations
MICROSOFT_CLIENT_ID="your_microsoft_app_client_id"
MICROSOFT_CLIENT_SECRET="your_microsoft_app_client_secret"
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="https://your-domain.com/api/integrations/microsoft-calendar/callback"

# Public app URL for scheduling links in SMS
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

---

## 4. Configure Twilio Webhook URLs

After assigning a virtual number in the plugin settings, configure its Twilio webhooks to point to your app.

Using the Twilio CLI:

```bash
twilio phone-numbers:update <PHONE_NUMBER_SID> \
  --voice-url "https://your-domain.com/api/webhooks/twilio/voice" \
  --status-callback "https://your-domain.com/api/webhooks/twilio/status"
```

Or via the Twilio Console: Phone Numbers → Manage → Active Numbers → select number → Voice & Fax settings.

**For local development**, use [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# then use the ngrok URL above
```

---

## 5. Install and Configure the Plugin

1. Go to **Settings → Plugins** in the SyncCoreHub dashboard
2. Find **Smart Call Routing** and click **Install**
3. Open **Settings → Call Routing**
4. Click **Assign New Number**, enter an area code, and purchase a virtual number
5. Expand the number and configure:
   - Available days and hours (e.g. Mon–Fri, 9am–5pm)
   - Timezone
   - Appointment slot duration
   - Your real phone number to forward calls to
6. Click **Connect Google Calendar** or **Connect Microsoft Calendar** to link your calendar

---

## 6. Set Up OAuth App Registrations

### Google Calendar
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing), enable **Google Calendar API**
3. Create OAuth 2.0 credentials → Web application
4. Add authorized redirect URI: `https://your-domain.com/api/integrations/google-calendar/callback`
5. Copy Client ID and Client Secret to `.env`

### Microsoft Calendar
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations
2. New registration, add redirect URI: `https://your-domain.com/api/integrations/microsoft-calendar/callback`
3. Under **API permissions**, add `Calendars.Read` (Microsoft Graph, Delegated)
4. Create a client secret under **Certificates & secrets**
5. Copy Application (client) ID and secret to `.env`

---

## 7. Testing the Full Flow

1. **Call test**: Dial the virtual number from any phone. Let it ring 20+ seconds without answering.
2. **IVR test**: After timeout you should hear the IVR. Speak your name, enter a callback number via keypad.
3. **SMS test**: You should receive an SMS with a link to `/schedule/<token>`
4. **Scheduling page**: Open the link, pick a slot, confirm the appointment.
5. **Confirmation test**: Both the caller (SMS) and the recipient (email) should receive confirmations.
6. **CRM check**: Go to CRM → Activities. A new **Meeting** activity should appear linked to the appointment.
7. **Calendar blocking test**: Add a Google/Outlook event during business hours → verify that time slot does not appear on the scheduling page.

---

## 8. Key File Reference

| Area | File |
|------|------|
| DB Schema | `packages/database/src/schema/call-routing.ts` |
| Plugin Manifest | `packages/plugins/src/plugins/call-routing.ts` |
| tRPC Router | `apps/web/server/routers/call-routing.ts` |
| Twilio Voice Webhook | `apps/web/app/api/webhooks/twilio/voice/route.ts` |
| Twilio IVR Gather | `apps/web/app/api/webhooks/twilio/gather/route.ts` |
| Google Calendar OAuth | `apps/web/app/api/integrations/google-calendar/` |
| Microsoft Calendar OAuth | `apps/web/app/api/integrations/microsoft-calendar/` |
| Public Scheduling Page | `apps/web/app/schedule/[token]/page.tsx` |
| Booking Confirm API | `apps/web/app/api/schedule/[token]/confirm/route.ts` |
| SMS Worker | `apps/worker/src/workers/call-routing-sms.ts` |
| Confirmation Worker | `apps/worker/src/workers/appointment-confirmation.ts` |
| Settings UI | `apps/web/app/(dashboard)/settings/call-routing/page.tsx` |
| Email Template | `packages/email/src/templates/appointment-confirmation.tsx` |
| Crypto Helpers | `apps/web/server/lib/crypto.ts` |
