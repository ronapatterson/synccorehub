"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SlotSnapshot } from "@synccorehub/database/schema";

interface SchedulingUIProps {
  token: string;
  sessionId: string;
  callerName?: string;
  callerPhone: string;
  recipientName: string;
  slots: SlotSnapshot[];
}

export function SchedulingUI({
  token,
  callerName,
  callerPhone,
  recipientName,
  slots,
}: SchedulingUIProps) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState(callerName ?? "");
  const [phone, setPhone] = useState(callerPhone);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const hasSlots = slots.length > 0 && slots.some((d) => d.slots.length > 0);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    setIsConfirming(true);
    setError(null);

    try {
      const res = await fetch(`/api/schedule/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIso: selectedSlot, callerName: name, callerPhone: phone }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setIsConfirming(false);
        return;
      }

      router.push(`/schedule/${token}/confirmed`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsConfirming(false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Book a callback with {recipientName}
        </h1>
        <p className="text-gray-500 text-sm">
          Pick a time that works for you. You'll receive a confirmation text.
        </p>
      </div>

      {!hasSlots ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No available slots</h2>
          <p className="text-gray-500 text-sm">
            There are no open slots in the next 14 days. Please call back to check for
            availability.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((day) =>
            day.slots.length === 0 ? null : (
              <div
                key={day.date}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5"
              >
                <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
                  {formatDate(day.date)}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {day.slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setShowConfirmModal(true);
                      }}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        selectedSlot === slot
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirmModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Confirm your booking</h2>
            <p className="text-gray-500 text-sm mb-5">
              {formatDate(selectedSlot.split("T")[0]!)} at {formatTime(selectedSlot)}
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Callback number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedSlot(null);
                  setError(null);
                }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming || !phone}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? "Booking…" : "Confirm appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
