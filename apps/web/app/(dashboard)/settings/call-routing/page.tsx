"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import {
  PhoneForwarded,
  Phone,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calendar,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

const MISSED_CALL_STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive" | "warning" | "info"> = {
  missed: "secondary",
  sms_sent: "info",
  session_created: "info",
  scheduled: "success",
  expired: "warning",
  no_action: "secondary",
};

const APPT_STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  confirmed: "success",
  cancelled: "destructive",
  completed: "success",
  no_show: "warning",
  rescheduled: "warning",
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CallRoutingPage() {
  const [activeTab, setActiveTab] = useState<"numbers" | "missed" | "appointments">("numbers");
  const [expandedNumberId, setExpandedNumberId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Assign number form
  const [assignForm, setAssignForm] = useState({
    areaCode: "",
    label: "",
    forwardToNumber: "",
  });

  // Availability edit state per number
  const [availEdits, setAvailEdits] = useState<
    Record<string, { days: number[]; startHour: number; endHour: number; timezone: string; slotDurationMinutes: number }>
  >({});

  const { data: numbers, refetch: refetchNumbers } = trpc.callRouting.getNumbers.useQuery();
  const { data: missedCalls } = trpc.callRouting.getMissedCalls.useQuery(
    { page: 1, limit: 50 },
    { enabled: activeTab === "missed" }
  );
  const { data: appointments, refetch: refetchAppts } = trpc.callRouting.getAppointments.useQuery(
    { page: 1, limit: 50 },
    { enabled: activeTab === "appointments" }
  );

  const assignNumber = trpc.callRouting.assignNumber.useMutation({
    onSuccess: () => {
      toast.success("Virtual number assigned successfully");
      setShowAssignModal(false);
      setAssignForm({ areaCode: "", label: "", forwardToNumber: "" });
      refetchNumbers();
    },
    onError: (err) => toast.error(err.message),
  });

  const releaseNumber = trpc.callRouting.releaseNumber.useMutation({
    onSuccess: () => {
      toast.success("Number released");
      refetchNumbers();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAvailability = trpc.callRouting.updateAvailability.useMutation({
    onSuccess: () => {
      toast.success("Availability saved");
      refetchNumbers();
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectCalendar = trpc.callRouting.disconnectCalendar.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`${vars.provider === "google" ? "Google" : "Microsoft"} Calendar disconnected`);
      refetchNumbers();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelAppointment = trpc.callRouting.cancelAppointment.useMutation({
    onSuccess: () => {
      toast.success("Appointment cancelled");
      refetchAppts();
    },
    onError: (err) => toast.error(err.message),
  });

  function initAvailEdit(numberId: string, config: {
    days?: number[]; startHour?: number; endHour?: number; timezone?: string; slotDurationMinutes?: number;
  } | null) {
    setAvailEdits((prev) => ({
      ...prev,
      [numberId]: {
        days: config?.days ?? [1, 2, 3, 4, 5],
        startHour: config?.startHour ?? 9,
        endHour: config?.endHour ?? 17,
        timezone: config?.timezone ?? "America/New_York",
        slotDurationMinutes: config?.slotDurationMinutes ?? 30,
      },
    }));
  }

  function toggleExpandNumber(numberId: string, config: {
    days?: number[]; startHour?: number; endHour?: number; timezone?: string; slotDurationMinutes?: number;
  } | null) {
    if (expandedNumberId === numberId) {
      setExpandedNumberId(null);
    } else {
      setExpandedNumberId(numberId);
      if (!availEdits[numberId]) {
        initAvailEdit(numberId, config);
      }
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PhoneForwarded className="h-6 w-6 text-primary" />
          Smart Call Routing
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Route missed calls to an IVR that collects caller info and sends a scheduling link.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["numbers", "missed", "appointments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "numbers" ? "Virtual Numbers" : tab === "missed" ? "Missed Calls" : "Appointments"}
          </button>
        ))}
      </div>

      {/* ── Virtual Numbers tab ───────────────────────────────────────────── */}
      {activeTab === "numbers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {numbers?.length ?? 0} virtual number{numbers?.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Assign number
            </button>
          </div>

          {!numbers || numbers.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-card border rounded-xl">
              <Phone className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No virtual numbers assigned</p>
              <p className="text-sm text-muted-foreground mt-1">
                Assign a Twilio number to start routing missed calls.
              </p>
            </div>
          ) : (
            numbers.map((number) => {
              const isExpanded = expandedNumberId === number.id;
              const edit = availEdits[number.id];

              return (
                <div key={number.id} className="bg-card border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono">
                        {formatPhone(number.phoneNumber)}
                      </p>
                      {number.label && (
                        <p className="text-xs text-muted-foreground">{number.label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {number.googleCalendarConnected && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                          Google Calendar
                        </span>
                      )}
                      {number.microsoftCalendarConnected && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                          Outlook
                        </span>
                      )}
                      <Badge variant="success" className="text-xs">Active</Badge>
                      <button
                        onClick={() => toggleExpandNumber(number.id, number.availabilityConfig as Record<string, unknown> | null)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Release ${number.phoneNumber}? This cannot be undone.`)) {
                            releaseNumber.mutate({ numberId: number.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && edit && (
                    <div className="border-t bg-muted/20 px-4 pb-5 pt-4 space-y-5">
                      {/* Availability days */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Available days</label>
                        <div className="flex gap-2">
                          {DAYS.map((day, i) => (
                            <button
                              key={day}
                              onClick={() => {
                                setAvailEdits((prev) => ({
                                  ...prev,
                                  [number.id]: {
                                    ...prev[number.id]!,
                                    days: prev[number.id]!.days.includes(i)
                                      ? prev[number.id]!.days.filter((d) => d !== i)
                                      : [...prev[number.id]!.days, i],
                                  },
                                }));
                              }}
                              className={`w-9 h-9 rounded-lg text-xs font-medium border transition-colors ${
                                edit.days.includes(i)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-input text-muted-foreground hover:border-primary"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Hours */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Start hour</label>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={edit.startHour}
                            onChange={(e) =>
                              setAvailEdits((prev) => ({
                                ...prev,
                                [number.id]: { ...prev[number.id]!, startHour: parseInt(e.target.value) || 0 },
                              }))
                            }
                            className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">End hour</label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={edit.endHour}
                            onChange={(e) =>
                              setAvailEdits((prev) => ({
                                ...prev,
                                [number.id]: { ...prev[number.id]!, endHour: parseInt(e.target.value) || 17 },
                              }))
                            }
                            className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-muted-foreground">Slot duration (min)</label>
                          <select
                            value={edit.slotDurationMinutes}
                            onChange={(e) =>
                              setAvailEdits((prev) => ({
                                ...prev,
                                [number.id]: { ...prev[number.id]!, slotDurationMinutes: parseInt(e.target.value) },
                              }))
                            }
                            className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={60}>60 min</option>
                          </select>
                        </div>
                      </div>

                      {/* Timezone */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Timezone</label>
                        <select
                          value={edit.timezone}
                          onChange={(e) =>
                            setAvailEdits((prev) => ({
                              ...prev,
                              [number.id]: { ...prev[number.id]!, timezone: e.target.value },
                            }))
                          }
                          className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>

                      {/* Calendar integrations */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Calendar integrations</label>
                        <div className="flex gap-2 flex-wrap">
                          {number.googleCalendarConnected ? (
                            <button
                              onClick={() =>
                                disconnectCalendar.mutate({ numberId: number.id, provider: "google" })
                              }
                              className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                            >
                              <X className="h-3 w-3" /> Disconnect Google Calendar
                            </button>
                          ) : (
                            <a
                              href={`/api/integrations/google-calendar/auth?numberId=${number.id}`}
                              className="flex items-center gap-1.5 text-xs border border-blue-200 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                            >
                              <Calendar className="h-3 w-3" /> Connect Google Calendar
                            </a>
                          )}
                          {number.microsoftCalendarConnected ? (
                            <button
                              onClick={() =>
                                disconnectCalendar.mutate({ numberId: number.id, provider: "microsoft" })
                              }
                              className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                            >
                              <X className="h-3 w-3" /> Disconnect Outlook Calendar
                            </button>
                          ) : (
                            <a
                              href={`/api/integrations/microsoft-calendar/auth?numberId=${number.id}`}
                              className="flex items-center gap-1.5 text-xs border border-indigo-200 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                            >
                              <Calendar className="h-3 w-3" /> Connect Outlook Calendar
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() =>
                            updateAvailability.mutate({ numberId: number.id, config: edit })
                          }
                          disabled={updateAvailability.isPending}
                          className="text-sm px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
                        >
                          {updateAvailability.isPending ? "Saving…" : "Save availability"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Missed Calls tab ──────────────────────────────────────────────── */}
      {activeTab === "missed" && (
        <div>
          {!missedCalls || missedCalls.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-card border rounded-xl">
              <Phone className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No missed calls yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Calls that reach the IVR will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">From</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Caller name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {missedCalls.map((call) => (
                    <tr key={call.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(call.occurredAt.toString())}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{formatPhone(call.fromNumber)}</td>
                      <td className="px-4 py-3 text-xs">{call.callerName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={MISSED_CALL_STATUS_VARIANTS[call.status] ?? "secondary"}
                          className="text-xs capitalize"
                        >
                          {call.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments tab ──────────────────────────────────────────────── */}
      {activeTab === "appointments" && (
        <div>
          {!appointments || appointments.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-card border rounded-xl">
              <Clock className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No appointments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scheduled callbacks will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Caller</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(appt.scheduledAt.toString())}
                      </td>
                      <td className="px-4 py-3 text-xs">{appt.callerName ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{formatPhone(appt.callerPhone)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={APPT_STATUS_VARIANTS[appt.status] ?? "secondary"}
                          className="text-xs capitalize"
                        >
                          {appt.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {appt.status === "confirmed" && (
                          <button
                            onClick={() => {
                              if (confirm("Cancel this appointment?")) {
                                cancelAppointment.mutate({ appointmentId: appt.id });
                              }
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Assign Number Modal ───────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Assign virtual number</h2>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium mb-1">Area code (optional)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={assignForm.areaCode}
                  onChange={(e) => setAssignForm({ ...assignForm, areaCode: e.target.value.replace(/\D/g, "") })}
                  placeholder="e.g. 212"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={assignForm.label}
                  onChange={(e) => setAssignForm({ ...assignForm, label: e.target.value })}
                  placeholder="e.g. Sales line"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Forward-to number (optional)</label>
                <input
                  type="tel"
                  value={assignForm.forwardToNumber}
                  onChange={(e) => setAssignForm({ ...assignForm, forwardToNumber: e.target.value })}
                  placeholder="+1 (555) 000-0000 — tries this first"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If set, incoming calls ring this number first for 20 seconds before going to IVR.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-sm px-3 py-1.5 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  assignNumber.mutate({
                    areaCode: assignForm.areaCode || undefined,
                    label: assignForm.label || undefined,
                    forwardToNumber: assignForm.forwardToNumber || undefined,
                  })
                }
                disabled={assignNumber.isPending}
                className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {assignNumber.isPending ? "Assigning…" : "Assign number"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
