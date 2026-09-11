"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SPECIALIZATIONS = [
  "Medicine", "Cardiology", "Dermatology", "Gynecology",
  "Pediatrics", "Neurology", "Orthopedics", "Psychiatry",
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"PATIENT" | "DOCTOR">("PATIENT");
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", gender: "",
    bmdcNumber: "", specialization: "Medicine", feeBdt: "", experienceYrs: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body: any = {
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
      gender: form.gender || undefined,
      role,
    };
    if (role === "DOCTOR") {
      body.bmdcNumber = form.bmdcNumber;
      body.specialization = form.specialization;
      body.feeBdt = Number(form.feeBdt);
      body.experienceYrs = Number(form.experienceYrs || 0);
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      // The API returns either a plain string or a zod error object —
      // handle both so the page never tries to render an object.
      if (typeof data.error === "string") {
        setError(data.error);
      } else if (data.error?.fieldErrors) {
        const messages = Object.values(data.error.fieldErrors).flat();
        setError(messages.length > 0 ? messages.join(", ") : "Registration failed");
      } else {
        setError("Registration failed");
      }
      return;
    }

    router.push(data.needsApproval ? "/login?pending=1" : "/login");
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">Create an account</h1>

      <div className="mb-4 flex gap-2">
        <button
          type="button" onClick={() => setRole("PATIENT")}
          className={`flex-1 rounded border py-2 text-sm ${role === "PATIENT" ? "border-brand-500 bg-brand-50" : ""}`}
        >
          I&apos;m a patient
        </button>
        <button
          type="button" onClick={() => setRole("DOCTOR")}
          className={`flex-1 rounded border py-2 text-sm ${role === "DOCTOR" ? "border-brand-500 bg-brand-50" : ""}`}
        >
          I&apos;m a doctor
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input required placeholder="Full name" className="w-full rounded border p-2 text-sm"
          value={form.name} onChange={(e) => update("name", e.target.value)} />
        <input required type="email" placeholder="Email" className="w-full rounded border p-2 text-sm"
          value={form.email} onChange={(e) => update("email", e.target.value)} />
        <input required type="password" placeholder="Password (at least 6 characters)"
          className="w-full rounded border p-2 text-sm"
          value={form.password} onChange={(e) => update("password", e.target.value)} />
        <input placeholder="Phone" className="w-full rounded border p-2 text-sm"
          value={form.phone} onChange={(e) => update("phone", e.target.value)} />

        <select className="w-full rounded border p-2 text-sm"
          value={form.gender} onChange={(e) => update("gender", e.target.value)}>
          <option value="">Gender (optional)</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>

        {role === "DOCTOR" && (
          <>
            <input required placeholder="BMDC registration number"
              className="w-full rounded border p-2 text-sm"
              value={form.bmdcNumber} onChange={(e) => update("bmdcNumber", e.target.value)} />
            <select required className="w-full rounded border p-2 text-sm"
              value={form.specialization} onChange={(e) => update("specialization", e.target.value)}>
              {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex gap-2">
              <input required type="number" placeholder="Fee (BDT)"
                className="w-1/2 rounded border p-2 text-sm"
                value={form.feeBdt} onChange={(e) => update("feeBdt", e.target.value)} />
              <input type="number" placeholder="Years experience"
                className="w-1/2 rounded border p-2 text-sm"
                value={form.experienceYrs} onChange={(e) => update("experienceYrs", e.target.value)} />
            </div>
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
              Doctor accounts are reviewed before going live. An administrator
              verifies your BMDC registration number against the official
              register — you will not appear in search results until then.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={loading}
          className="w-full rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
