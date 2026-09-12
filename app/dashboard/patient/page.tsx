"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";

interface Appt {
  id: string;
  status: string;
  urgency: string;
  feeBdt: number;
  decisionNote: string | null;
  cancelReason: string | null;
  consultationNotes: string | null;
  prescription: string | null;
  slot: { startTime: string };
  proposedSlot: { id: string; startTime: string } | null;
  doctor: { id: string; user: { name: string }; hospital: { name: string } | null };
  patientProfile: { name: string; relationship: string; isSelf: boolean } | null;
  payment: { status: string } | null;
  review: { id: string; rating: number; reply: { body: string } | null } | null;
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

const STATUS_EXPLAIN: Record<string, string> = {
  PENDING_DOCTOR_REVIEW:
    "The doctor is reviewing your answers and will confirm, suggest another time, or let you know if they cannot take this.",
  RESCHEDULE_PROPOSED: "The doctor has suggested a different time. Accept or decline below.",
  REJECTED: "The doctor could not take this appointment. Your payment is being refunded.",
  CANCELLED: "This appointment was cancelled. Any payment made is being refunded.",
};

function PatientDashboardInner() {
  const searchParams = useSearchParams();
  const paymentFlag = searchParams.get("payment");
  const { t } = useLang();

  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submitReview = async (appointmentId: string) => {
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, rating, comment }),
    });
    setReviewFor(null);
    setComment("");
    setRating(5);
    load();
  };

  const respondReschedule = async (id: string, accept: boolean) => {
    await fetch(`/api/appointments/${id}/reschedule-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    load();
  };

  const cancel = async (id: string) => {
    await fetch(`/api/appointments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason }),
    });
    setCancelFor(null);
    setCancelReason("");
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/doctors"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("findDoctor")}
        </Link>
        <Link
          href="/dashboard/patient/favorites"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("favourites")}
        </Link>
        <Link
          href="/dashboard/patient/family"
          className="rounded border bg-white px-4 py-2 text-sm hover:border-brand-500"
        >
          {t("familyMembers")}
        </Link>
      </div>

      <h1 className="mb-4 text-xl font-semibold">{t("myAppointments")}</h1>

      {paymentFlag === "success" && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
          Payment received (sandbox). Your request has gone to the doctor for review.
        </p>
      )}
      {paymentFlag === "devbypass" && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Developer bypass:</strong> no payment gateway is configured, so
          no sandbox transaction took place. The appointment was sent to the
          doctor for review anyway. Add your SSLCommerz sandbox credentials to
          .env.local to exercise the real payment flow.
        </p>
      )}
      {paymentFlag === "failed" && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          Payment failed or was cancelled — the slot has been released.
        </p>
      )}

      {loading && <p>Loading…</p>}

      <div className="space-y-3">
        {appointments.map((a) => (
          <div key={a.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">Dr. {a.doctor.user.name}</p>
                {a.doctor.hospital && (
                  <p className="text-sm text-gray-500">{a.doctor.hospital.name}</p>
                )}
                <p className="text-sm text-gray-600">
                  {new Date(a.slot.startTime).toLocaleString()}
                </p>
                {a.patientProfile && !a.patientProfile.isSelf && (
                  <p className="mt-1 text-xs text-gray-500">
                    For {a.patientProfile.name} ({a.patientProfile.relationship})
                  </p>
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
                {a.urgency === "URGENT" && (
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    Doctor marked this urgent
                  </p>
                )}
              </div>
            </div>

            {STATUS_EXPLAIN[a.status] && (
              <p className="mt-2 text-sm text-gray-600">{STATUS_EXPLAIN[a.status]}</p>
            )}

            {a.decisionNote && (
              <p className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-700">
                Doctor&apos;s note: {a.decisionNote}
              </p>
            )}

            {/* Reschedule proposal */}
            {a.status === "RESCHEDULE_PROPOSED" && a.proposedSlot && (
              <div className="mt-3 rounded border border-blue-300 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900">
                  Proposed new time: {new Date(a.proposedSlot.startTime).toLocaleString()}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => respondReschedule(a.id, true)}
                    className="rounded bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600"
                  >
                    Accept new time
                  </button>
                  <button
                    onClick={() => respondReschedule(a.id, false)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Decline & refund
                  </button>
                </div>
              </div>
            )}

            {/* Consultation notes after completion */}
            {a.status === "COMPLETED" && (a.consultationNotes || a.prescription) && (
              <div className="mt-3">
                <button
                  onClick={() => setOpenNotes(openNotes === a.id ? null : a.id)}
                  className="text-sm text-brand-600 underline"
                >
                  {openNotes === a.id ? "Hide" : t("viewNotes")}
                </button>
                {openNotes === a.id && (
                  <div className="mt-2 space-y-2 rounded border bg-gray-50 p-3 text-sm">
                    {a.consultationNotes && (
                      <div>
                        <p className="font-medium">{t("consultationNotes")}</p>
                        <p className="whitespace-pre-wrap text-gray-700">
                          {a.consultationNotes}
                        </p>
                      </div>
                    )}
                    {a.prescription && (
                      <div>
                        <p className="font-medium">{t("prescription")}</p>
                        <p className="whitespace-pre-wrap text-gray-700">{a.prescription}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {["PENDING_DOCTOR_REVIEW", "BOOKED"].includes(a.status) && (
                <button
                  onClick={() => setCancelFor(cancelFor === a.id ? null : a.id)}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  {t("cancelAppointment")}
                </button>
              )}

              {["COMPLETED", "CANCELLED", "REJECTED"].includes(a.status) && (
                <Link
                  href={`/doctors/${a.doctor.id}`}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {t("bookAgain")}
                </Link>
              )}

              {a.status === "COMPLETED" && !a.review && (
                <button
                  onClick={() => setReviewFor(reviewFor === a.id ? null : a.id)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {t("leaveReview")}
                </button>
              )}
            </div>

            {cancelFor === a.id && (
              <div className="mt-3 rounded border bg-gray-50 p-3">
                <textarea
                  rows={2}
                  placeholder="Reason (optional)"
                  className="w-full rounded border p-2 text-sm"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <button
                  onClick={() => cancel(a.id)}
                  className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                >
                  Confirm cancellation
                </button>
              </div>
            )}

            {reviewFor === a.id && (
              <div className="mt-3 space-y-2 rounded border bg-gray-50 p-3">
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="rounded border p-1 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ⭐
                    </option>
                  ))}
                </select>
                <textarea
                  placeholder="Optional comment"
                  className="w-full rounded border p-2 text-sm"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  onClick={() => submitReview(a.id)}
                  className="rounded bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600"
                >
                  {t("submitReview")}
                </button>
              </div>
            )}

            {a.review && (
              <div className="mt-2 text-sm text-gray-500">
                <p>
                  {t("youRated")} ⭐ {a.review.rating}/5
                </p>
                {a.review.reply && (
                  <p className="mt-1 rounded bg-brand-50 p-2 text-gray-700">
                    <span className="font-medium text-brand-700">{t("doctorReplied")}: </span>
                    {a.review.reply.body}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {!loading && appointments.length === 0 && (
          <p className="text-gray-500">{t("noAppointments")}</p>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams() needs a Suspense boundary above it, otherwise Next.js
 * cannot prerender this route at build time.
 */
export default function PatientDashboard() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading your appointments…</p>}>
      <PatientDashboardInner />
    </Suspense>
  );
}
