"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

interface Appt {
  id: string;
  status: string;
  urgency: string;
  feeBdt: number;
  decisionNote: string | null;
  consultationNotes: string | null;
  slot: { startTime: string };
  proposedSlot: { id: string; startTime: string } | null;
  patient: { name: string; phone: string | null; email: string };
  patientProfile: { name: string; relationship: string; dateOfBirth: string | null } | null;
  payment: { status: string } | null;
  intake: {
    specialization: string;
    answers: { questionId: string; question: string; answer: any }[];
    flaggedForReview: boolean;
    flagReason: string | null;
  } | null;
  review: { id: string; rating: number; comment: string | null; reply: { body: string } | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-gray-100 text-gray-700",
  PENDING_DOCTOR_REVIEW: "bg-amber-100 text-amber-800",
  BOOKED: "bg-green-100 text-green-800",
  RESCHEDULE_PROPOSED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

export default function DoctorDashboard() {
  const { t } = useLang();
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [openIntake, setOpenIntake] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [prescription, setPrescription] = useState("");
  const [freeSlots, setFreeSlots] = useState<{ id: string; startTime: string }[]>([]);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadFreeSlots = async () => {
    const res = await fetch("/api/doctors/me/slots");
    const d = await res.json();
    setFreeSlots(
      (d.slots || [])
        .filter((s: any) => !s.isBooked)
        .map((s: any) => ({ id: s.id, startTime: s.startTime }))
    );
  };

  const decide = async (id: string, payload: any) => {
    const res = await fetch(`/api/appointments/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const e = await res.json();
      alert(e.error || "Action failed");
      return;
    }
    setActionFor(null);
    setRescheduleFor(null);
    setRejectReason("");
    load();
  };

  const complete = async (id: string) => {
    await fetch(`/api/appointments/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationNotes: notes, prescription }),
    });
    setNotesFor(null);
    setNotes("");
    setPrescription("");
    load();
  };

  const sendReply = async (reviewId: string) => {
    await fetch(`/api/reviews/${reviewId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });
    setReplyFor(null);
    setReplyBody("");
    load();
  };

  const pendingCount = appointments.filter(
    (a) => a.status === "PENDING_DOCTOR_REVIEW"
  ).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/doctor/availability"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("manageAvailability")}
        </Link>
        <Link
          href="/dashboard/doctor/profile"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("myProfile")}
        </Link>
        <Link
          href="/dashboard/doctor/earnings"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("earnings")}
        </Link>
      </div>

      {pendingCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {pendingCount} appointment{pendingCount > 1 ? "s" : ""} waiting for your review.
        </div>
      )}

      <h1 className="mb-4 text-xl font-semibold">{t("myAppointments")}</h1>
      {loading && <p>Loading…</p>}

      <div className="space-y-3">
        {appointments.map((a) => {
          const subject = a.patientProfile?.name ?? a.patient.name;
          const isFamily = a.patientProfile && !a.patientProfile.relationship.includes("Self");

          return (
            <div
              key={a.id}
              className={`rounded-xl border bg-white p-4 ${
                a.urgency === "URGENT" ? "border-red-400" : ""
              } ${a.intake?.flaggedForReview ? "border-amber-400" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{subject}</p>
                    {isFamily && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {a.patientProfile!.relationship} of {a.patient.name}
                      </span>
                    )}
                    {a.urgency === "URGENT" && (
                      <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {t("urgent")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(a.slot.startTime).toLocaleString()}
                  </p>
                  {a.patient.phone && (
                    <p className="text-sm text-gray-500">{a.patient.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">৳{a.feeBdt}</p>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[a.status] ?? "bg-gray-100"
                    }`}
                  >
                    {a.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>

              {a.intake?.flaggedForReview && (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
                  <p className="font-semibold text-amber-900">{t("flaggedForAttention")}</p>
                  <p className="text-amber-900">{a.intake.flagReason}</p>
                </div>
              )}

              {a.intake && (
                <div className="mt-3">
                  <button
                    onClick={() => setOpenIntake(openIntake === a.id ? null : a.id)}
                    className="text-sm text-brand-600 underline"
                  >
                    {openIntake === a.id ? "Hide" : "View"} {t("patientAnswers")}
                  </button>

                  {openIntake === a.id && (
                    <div className="mt-2 space-y-2 rounded border bg-gray-50 p-3">
                      {a.intake.answers.map((ans) => (
                        <div key={ans.questionId} className="text-sm">
                          <p className="font-medium text-gray-700">{ans.question}</p>
                          <p className="text-gray-900">
                            {Array.isArray(ans.answer)
                              ? ans.answer.join(", ")
                              : String(ans.answer)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Decision controls */}
              {["PENDING_DOCTOR_REVIEW", "BOOKED", "RESCHEDULE_PROPOSED"].includes(a.status) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {a.status === "PENDING_DOCTOR_REVIEW" && (
                    <button
                      onClick={() => decide(a.id, { action: "accept" })}
                      className="rounded bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600"
                    >
                      {t("accept")}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      decide(a.id, {
                        action: "set_urgency",
                        urgency: a.urgency === "URGENT" ? "NORMAL" : "URGENT",
                      })
                    }
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {a.urgency === "URGENT" ? "Remove urgent" : t("markUrgent")}
                  </button>

                  <button
                    onClick={async () => {
                      await loadFreeSlots();
                      setRescheduleFor(rescheduleFor === a.id ? null : a.id);
                    }}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {t("proposeNewTime")}
                  </button>

                  <button
                    onClick={() => setActionFor(actionFor === a.id ? null : a.id)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    {t("decline")}
                  </button>

                  {a.status === "BOOKED" && (
                    <button
                      onClick={() => setNotesFor(notesFor === a.id ? null : a.id)}
                      className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                      {t("markComplete")}
                    </button>
                  )}
                </div>
              )}

              {rescheduleFor === a.id && (
                <div className="mt-3 rounded border bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-medium">Pick a different time to offer</p>
                  {freeSlots.length === 0 && (
                    <p className="text-sm text-gray-500">
                      You have no free slots. Add some under Manage availability.
                    </p>
                  )}
                  <div className="grid max-h-40 gap-1 overflow-y-auto">
                    {freeSlots.map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          decide(a.id, { action: "propose_reschedule", newSlotId: s.id })
                        }
                        className="rounded border bg-white p-2 text-left text-sm hover:border-brand-500"
                      >
                        {new Date(s.startTime).toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {actionFor === a.id && (
                <div className="mt-3 rounded border bg-gray-50 p-3">
                  <label className="mb-1 block text-sm font-medium">
                    Reason for declining (the patient will see this)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded border p-2 text-sm"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. This needs an in-person examination at a hospital"
                  />
                  <button
                    disabled={rejectReason.trim().length < 3}
                    onClick={() => decide(a.id, { action: "reject", reason: rejectReason })}
                    className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm decline & refund
                  </button>
                </div>
              )}

              {notesFor === a.id && (
                <div className="mt-3 space-y-2 rounded border bg-gray-50 p-3">
                  <label className="block text-sm font-medium">{t("consultationNotes")}</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border p-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What you discussed, findings, advice given"
                  />
                  <label className="block text-sm font-medium">{t("prescription")}</label>
                  <textarea
                    rows={3}
                    className="w-full rounded border p-2 text-sm"
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    placeholder="Medicines, dosage, duration"
                  />
                  <button
                    onClick={() => complete(a.id)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                  >
                    Save & mark completed
                  </button>
                </div>
              )}

              {a.decisionNote && (
                <p className="mt-2 text-sm text-gray-500">Note: {a.decisionNote}</p>
              )}

              {a.review && (
                <div className="mt-3 rounded border-t pt-3">
                  <p className="text-sm">
                    Patient rated ⭐ {a.review.rating}/5
                    {a.review.comment && ` — "${a.review.comment}"`}
                  </p>
                  {a.review.reply ? (
                    <p className="mt-1 text-sm text-gray-600">
                      Your reply: {a.review.reply.body}
                    </p>
                  ) : replyFor === a.review.id ? (
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        className="w-full rounded border p-2 text-sm"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                      />
                      <button
                        onClick={() => sendReply(a.review!.id)}
                        className="mt-1 rounded bg-brand-500 px-3 py-1 text-sm text-white"
                      >
                        Post reply
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplyFor(a.review!.id)}
                      className="mt-1 text-sm text-brand-600 underline"
                    >
                      Reply to this review
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && appointments.length === 0 && (
          <p className="text-gray-500">{t("noAppointments")}</p>
        )}
      </div>
    </div>
  );
}
