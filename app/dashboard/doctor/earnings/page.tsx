"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Earnings {
  total: number;
  thisWeek: number;
  thisMonth: number;
  consultationCount: number;
  byMonth: { month: string; amount: number; count: number }[];
  refunded: { amount: number; count: number };
}

export default function EarningsPage() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctors/me/earnings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || "Could not load earnings");
        return d;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/doctor" className="text-sm text-brand-600 underline">
          ← Back to dashboard
        </Link>
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return <p>Loading…</p>;

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/doctor" className="text-sm text-brand-600 underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-xl font-semibold">Earnings</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">This week</p>
          <p className="text-2xl font-bold text-brand-700">৳{data.thisWeek}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">This month</p>
          <p className="text-2xl font-bold text-brand-700">৳{data.thisMonth}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">All time</p>
          <p className="text-2xl font-bold text-brand-700">৳{data.total}</p>
          <p className="text-xs text-gray-500">{data.consultationCount} consultations</p>
        </div>
      </div>

      {data.refunded.count > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Refunded to patients</p>
          <p className="text-lg font-semibold text-red-600">
            ৳{data.refunded.amount}{" "}
            <span className="text-sm font-normal text-gray-500">
              across {data.refunded.count} appointment{data.refunded.count > 1 ? "s" : ""}
            </span>
          </p>
        </div>
      )}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">By month</h2>
        {data.byMonth.length === 0 && (
          <p className="text-sm text-gray-500">No completed consultations yet.</p>
        )}
        <div className="space-y-2">
          {data.byMonth.map((m) => (
            <div key={m.month} className="flex items-center justify-between border-b pb-2 text-sm">
              <span>{monthLabel(m.month)}</span>
              <span className="text-gray-500">{m.count} consultations</span>
              <span className="font-semibold">৳{m.amount}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
