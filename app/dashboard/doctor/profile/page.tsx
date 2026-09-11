"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SPECIALIZATIONS = [
  "Medicine", "Cardiology", "Dermatology", "Gynecology",
  "Pediatrics", "Neurology", "Orthopedics", "Psychiatry",
];
const LANGUAGE_OPTIONS = ["Bengali", "English", "Hindi", "Urdu", "Arabic", "Chittagonian", "Sylheti"];

export default function DoctorProfilePage() {
  const [form, setForm] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctors/me")
      .then((r) => r.json())
      .then((d) => {
        setForm({
          name: d.user?.name ?? "",
          phone: d.user?.phone ?? "",
          bio: d.bio ?? "",
          feeBdt: d.feeBdt ?? 0,
          specialization: d.specialization ?? "Medicine",
          experienceYrs: d.experienceYrs ?? 0,
          gender: d.gender ?? "",
          languages: d.languages ?? [],
        });
        setStatus(d.verificationStatus);
      })
      .catch(() => setError("Could not load your profile"));
  }, []);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toggleLanguage = (l: string) => {
    const current: string[] = form.languages ?? [];
    update("languages", current.includes(l) ? current.filter((x) => x !== l) : [...current, l]);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);

    const res = await fetch("/api/doctors/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        bio: form.bio,
        feeBdt: Number(form.feeBdt),
        specialization: form.specialization,
        experienceYrs: Number(form.experienceYrs),
        gender: form.gender || null,
        languages: form.languages,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError("Could not save changes");
      return;
    }
    setMsg("Profile saved");
  };

  if (!form) return <p>Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/dashboard/doctor" className="text-sm text-brand-600 underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-xl font-semibold">My profile</h1>

      {status !== "APPROVED" && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your account is <strong>{status}</strong>. You will not appear in patient
          search results until an administrator verifies your BMDC registration.
        </div>
      )}

      {msg && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{msg}</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-3 rounded-xl border bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Full name</label>
          <input
            className="w-full rounded border p-2 text-sm"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <input
            className="w-full rounded border p-2 text-sm"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Specialization</label>
          <select
            className="w-full rounded border p-2 text-sm"
            value={form.specialization}
            onChange={(e) => update("specialization", e.target.value)}
          >
            {SPECIALIZATIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            This determines which intake questions patients answer before booking you.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Consultation fee (BDT)</label>
            <input
              type="number"
              className="w-full rounded border p-2 text-sm"
              value={form.feeBdt}
              onChange={(e) => update("feeBdt", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Years of experience</label>
            <input
              type="number"
              className="w-full rounded border p-2 text-sm"
              value={form.experienceYrs}
              onChange={(e) => update("experienceYrs", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Gender</label>
          <select
            className="w-full rounded border p-2 text-sm"
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Patients can filter by this — some prefer a doctor of a particular gender.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Languages spoken</label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLanguage(l)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  form.languages?.includes(l)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "hover:bg-gray-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">About you</label>
          <textarea
            rows={4}
            className="w-full rounded border p-2 text-sm"
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Your training, areas of focus, and what patients can expect."
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
