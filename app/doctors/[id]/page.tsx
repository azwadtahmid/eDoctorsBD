"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLang } from "@/components/LanguageProvider";
import IntakeForm from "@/components/IntakeForm";
import type { SubmittedAnswer } from "@/lib/intake-questions";

interface DoctorDetail {
  id: string;
  name: string;
  specialization: string;
  bio: string | null;
  experienceYrs: number;
  feeBdt: number;
  bmdcNumber: string;
  gender: string | null;
  languages: string[];
  avgRating: number;
  reviewCount: number;
  hospital: { name: string; city: string; address: string } | null;
  slots: { id: string; startTime: string }[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    patientName: string;
    createdAt: string;
    reply: { body: string; createdAt: string } | null;
  }[];
}

interface PatientProfile {
  id: string;
  name: string;
  relationship: string;
  isSelf: boolean;
}

type Step = "slot" | "intake";

export default function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useLang();

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("slot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/doctors/${id}`)
      .then((r) => r.json())
      .then(setDoctor)
      .catch(() => setError("Failed to load doctor"));
  }, [id]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/patient-profiles")
      .then((r) => r.json())
      .then((d) => {
        setProfiles(d.profiles ?? []);
        const self = (d.profiles ?? []).find((p: PatientProfile) => p.isSelf);
        if (self) setSelectedProfile(self.id);
      })
      .catch(() => {});
  }, [session]);

  const goToIntake = () => {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/doctors/${id}`);
      return;
    }
    if (!selectedSlot) return;
    setStep("intake");
  };

  const handleFinalSubmit = async (answers: SubmittedAnswer[]) => {
    setBusy(true);
    setError(null);

    try {
      const apptRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot,
          patientProfileId: selectedProfile || undefined,
          answers,
        }),
      });
      const appt = await apptRes.json();
      if (!apptRes.ok) throw new Error(appt.error || "Booking failed");

      const payRes = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id }),
      });
      const pay = await payRes.json();
      if (!payRes.ok) throw new Error(pay.error || "Payment init failed");

      window.location.href = pay.redirectUrl;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!doctor) return <p>Loading…</p>;

  if (step === "intake") {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6">
        <p className="mb-1 text-sm text-gray-500">
          Dr. {doctor.name} • {doctor.specialization} • ৳{doctor.feeBdt}
        </p>
        <IntakeForm
          specialization={doctor.specialization}
          submitting={busy}
          onBack={() => setStep("slot")}
          onSubmit={handleFinalSubmit}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-2xl font-bold">Dr. {doctor.name}</h1>
        <p className="text-gray-600">{doctor.specialization}</p>
        <p className="mt-1 text-sm text-gray-500">BMDC Reg. No: {doctor.bmdcNumber}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            ⭐ {doctor.avgRating.toFixed(1)} ({doctor.reviewCount} {t("reviews")})
          </span>
          <span>• {doctor.experienceYrs} {t("yrsExperience")}</span>
          {doctor.languages?.length > 0 && <span>• {doctor.languages.join(", ")}</span>}
        </div>

        {doctor.hospital && (
          <p className="mt-3 text-sm text-gray-600">
            {doctor.hospital.name} — {doctor.hospital.address}, {doctor.hospital.city}
          </p>
        )}

        {doctor.bio && <p className="mt-4 text-gray-700">{doctor.bio}</p>}

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t("patientReviews")}</h2>
          {doctor.reviews.length === 0 && (
            <p className="text-sm text-gray-500">{t("noReviews")}</p>
          )}
          <div className="space-y-3">
            {doctor.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border bg-white p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>{r.patientName}</span>
                  <span>⭐ {r.rating}/5</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                {r.reply && (
                  <div className="mt-2 rounded bg-brand-50 p-2 text-sm">
                    <p className="font-medium text-brand-700">{t("doctorReplied")}</p>
                    <p className="text-gray-700">{r.reply.body}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-xl border bg-white p-5">
        <p className="mb-4 text-xl font-semibold text-brand-700">৳{doctor.feeBdt}</p>

        {session?.user && profiles.length > 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">{t("bookingFor")}</label>
            <select
              className="w-full rounded border p-2 text-sm"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isSelf ? "(me)" : `(${p.relationship})`}
                </option>
              ))}
            </select>
            <a
              href="/dashboard/patient/family"
              className="mt-1 inline-block text-xs text-brand-600 underline"
            >
              {t("addFamilyMember")}
            </a>
          </div>
        )}

        <h3 className="mb-2 text-sm font-medium">{t("availableSlots")}</h3>
        {doctor.slots.length === 0 && (
          <p className="text-sm text-gray-500">{t("noSlots")}</p>
        )}
        <div className="mb-4 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto">
          {doctor.slots.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSlot(s.id)}
              className={`rounded border p-2 text-left text-sm ${
                selectedSlot === s.id ? "border-brand-500 bg-brand-50" : "hover:bg-gray-50"
              }`}
            >
              {new Date(s.startTime).toLocaleString()}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={!selectedSlot}
          onClick={goToIntake}
          className="w-full rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {t("bookAndPay")}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          You will answer a few questions for the doctor before paying.
        </p>
      </aside>
    </div>
  );
}
