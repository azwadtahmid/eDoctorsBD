"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Favorite {
  id: string;
  doctor: {
    id: string;
    specialization: string;
    feeBdt: number;
    avgRating: number;
    reviewCount: number;
    user: { name: string };
    hospital: { name: string; city: string } | null;
    slots: { startTime: string }[];
  };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((d) => setFavorites(d.favorites ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (doctorId: string) => {
    await fetch(`/api/favorites?doctorId=${doctorId}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <Link href="/dashboard/patient" className="text-sm text-brand-600 underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-xl font-semibold">Saved doctors</h1>

      {loading && <p>Loading…</p>}
      {!loading && favorites.length === 0 && (
        <p className="text-gray-500">
          You have not saved any doctors yet. Tap the ☆ on a doctor card to save them.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {favorites.map((f) => (
          <div key={f.id} className="rounded-xl border bg-white p-5">
            <div className="flex justify-between">
              <div>
                <Link
                  href={`/doctors/${f.doctor.id}`}
                  className="text-lg font-semibold hover:text-brand-600"
                >
                  Dr. {f.doctor.user.name}
                </Link>
                <p className="text-sm text-gray-600">{f.doctor.specialization}</p>
                {f.doctor.hospital && (
                  <p className="text-sm text-gray-500">
                    {f.doctor.hospital.name}, {f.doctor.hospital.city}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-brand-700">৳{f.doctor.feeBdt}</p>
                <button
                  onClick={() => remove(f.doctor.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              ⭐ {f.doctor.avgRating.toFixed(1)} ({f.doctor.reviewCount} reviews)
            </p>

            {f.doctor.slots.length > 0 ? (
              <p className="mt-2 text-sm text-brand-600">
                Next available: {new Date(f.doctor.slots[0].startTime).toLocaleString()}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No upcoming slots</p>
            )}

            <Link
              href={`/doctors/${f.doctor.id}`}
              className="mt-3 block rounded bg-brand-500 py-2 text-center text-sm font-medium text-white hover:bg-brand-600"
            >
              Book again
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
