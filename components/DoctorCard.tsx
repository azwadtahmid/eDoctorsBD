"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLang } from "./LanguageProvider";

export interface DoctorSearchResult {
  id: string;
  name: string;
  specialization: string;
  feeBdt: number;
  experienceYrs: number;
  avgRating: number;
  reviewCount: number;
  gender: string | null;
  languages: string[];
  hospital: { id: string; name: string; city: string } | null;
  distanceKm: number | null;
  nextSlots: { id: string; startTime: string }[];
  isFavorite?: boolean;
}

export default function DoctorCard({ doctor }: { doctor: DoctorSearchResult }) {
  const { data: session } = useSession();
  const { t } = useLang();
  const [isFav, setIsFav] = useState(!!doctor.isFavorite);
  const [busy, setBusy] = useState(false);

  const role = (session?.user as any)?.role;
  const canFavorite = session?.user && role === "PATIENT";

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !isFav;
    setIsFav(next);

    try {
      if (next) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doctorId: doctor.id }),
        });
      } else {
        await fetch(`/api/favorites?doctorId=${doctor.id}`, { method: "DELETE" });
      }
    } catch {
      setIsFav(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      href={`/doctors/${doctor.id}`}
      className="block rounded-xl border bg-white p-5 transition hover:border-brand-500 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Dr. {doctor.name}</h3>
          <p className="text-sm text-gray-600">{doctor.specialization}</p>
          {doctor.hospital && (
            <p className="mt-1 text-sm text-gray-500">
              {doctor.hospital.name}, {doctor.hospital.city}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className="font-semibold text-brand-700">৳{doctor.feeBdt}</p>
            <p className="text-xs text-gray-500">{t("consultationFee")}</p>
          </div>
          {canFavorite && (
            <button
              onClick={toggleFavorite}
              aria-label={isFav ? "Remove from saved" : "Save doctor"}
              className="text-xl leading-none transition hover:scale-110"
            >
              {isFav ? "★" : "☆"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
        <span>
          ⭐ {doctor.avgRating.toFixed(1)} ({doctor.reviewCount} {t("reviews")})
        </span>
        <span>• {doctor.experienceYrs} {t("yrsExperience")}</span>
        {doctor.distanceKm !== null && <span>• {doctor.distanceKm} km</span>}
      </div>

      {doctor.languages?.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">{doctor.languages.join(", ")}</p>
      )}

      {doctor.nextSlots.length > 0 && (
        <p className="mt-3 text-sm text-brand-600">
          {t("nextAvailable")}: {new Date(doctor.nextSlots[0].startTime).toLocaleString()}
        </p>
      )}
    </Link>
  );
}
