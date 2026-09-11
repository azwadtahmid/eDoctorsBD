"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Profile {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  gender: string | null;
  isSelf: boolean;
}

const RELATIONSHIPS = ["Child", "Parent", "Spouse", "Sibling", "Other"];

export default function FamilyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Child");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/patient-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const add = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter a name");
      return;
    }
    const res = await fetch("/api/patient-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        relationship,
        dateOfBirth: dob || null,
        gender: gender || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not add");
      return;
    }
    setName("");
    setDob("");
    setGender("");
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/patient-profiles?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not remove");
      return;
    }
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/dashboard/patient" className="text-sm text-brand-600 underline">
        ← Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Family members</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add the people you book appointments for. When booking, you choose who
          the appointment is for, and the doctor sees whose details they are
          reading.
        </p>
      </div>

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Add someone</h2>
        <div className="space-y-2">
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="w-full rounded border p-2 text-sm"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">Date of birth</label>
              <input
                type="date"
                className="w-full rounded border p-2 text-sm"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">Gender</label>
              <select
                className="w-full rounded border p-2 text-sm"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <button
            onClick={add}
            className="w-full rounded bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Add family member
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">People on this account</h2>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="text-sm font-medium">
                  {p.name}{" "}
                  <span className="text-gray-500">
                    {p.isSelf ? "(you)" : `— ${p.relationship}`}
                  </span>
                </p>
                {p.dateOfBirth && (
                  <p className="text-xs text-gray-500">
                    Born {new Date(p.dateOfBirth).toLocaleDateString()}
                  </p>
                )}
              </div>
              {!p.isSelf && (
                <button
                  onClick={() => remove(p.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
