"use client";

import { useEffect, useState } from "react";

interface AdminDoctor {
  id: string;
  bmdcNumber: string;
  specialization: string;
  feeBdt: number;
  experienceYrs: number;
  verificationStatus: string;
  rejectionReason: string | null;
  verifiedAt: string | null;
  user: { name: string; email: string; phone: string | null; createdAt: string };
  hospital: { name: string; city: string } | null;
  _count: { appointments: number };
}

const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

export default function AdminDashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (status: string) => {
    setLoading(true);
    fetch(`/api/admin/doctors?status=${status}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setDoctors(d.doctors ?? []);
        setCounts(d.counts ?? {});
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const decide = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/admin/doctors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action } : { action, reason }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Action failed");
      return;
    }
    setRejectFor(null);
    setReason("");
    load(tab);
  };

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Doctor verification</h1>
        <p className="mt-1 text-sm text-gray-600">
          Check each doctor&apos;s BMDC registration number against the official
          register before approving. Only approved doctors appear in patient search.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`rounded px-4 py-2 text-sm ${
              tab === tb ? "bg-brand-500 text-white" : "border bg-white hover:bg-gray-50"
            }`}
          >
            {tb.charAt(0) + tb.slice(1).toLowerCase()}{" "}
            {counts[tb] !== undefined && `(${counts[tb]})`}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}
      {!loading && doctors.length === 0 && (
        <p className="text-gray-500">Nothing in this queue.</p>
      )}

      <div className="space-y-3">
        {doctors.map((d) => (
          <div key={d.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-medium">Dr. {d.user.name}</p>
                <p className="text-sm text-gray-600">
                  {d.specialization} • {d.experienceYrs} yrs • ৳{d.feeBdt}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">BMDC Reg:</span>{" "}
                  <span className="font-mono">{d.bmdcNumber}</span>
                </p>
                <p className="text-sm text-gray-500">
                  {d.user.email}
                  {d.user.phone && ` • ${d.user.phone}`}
                </p>
                {d.hospital && (
                  <p className="text-sm text-gray-500">
                    {d.hospital.name}, {d.hospital.city}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Registered {new Date(d.user.createdAt).toLocaleDateString()} •{" "}
                  {d._count.appointments} appointments
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {d.verificationStatus !== "APPROVED" && (
                  <button
                    onClick={() => decide(d.id, "approve")}
                    className="rounded bg-brand-500 px-4 py-1.5 text-sm text-white hover:bg-brand-600"
                  >
                    Approve
                  </button>
                )}
                {d.verificationStatus !== "REJECTED" && (
                  <button
                    onClick={() => setRejectFor(rejectFor === d.id ? null : d.id)}
                    className="rounded border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>

            {d.rejectionReason && (
              <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">
                Rejected: {d.rejectionReason}
              </p>
            )}

            {rejectFor === d.id && (
              <div className="mt-3 rounded border bg-gray-50 p-3">
                <textarea
                  rows={2}
                  className="w-full rounded border p-2 text-sm"
                  placeholder="Reason for rejection (e.g. BMDC number could not be verified)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  disabled={reason.trim().length < 3}
                  onClick={() => decide(d.id, "reject")}
                  className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm rejection
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
