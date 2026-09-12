"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DoctorCard, { DoctorSearchResult } from "@/components/DoctorCard";
import { useLang } from "@/components/LanguageProvider";

const SPECIALIZATIONS = [
  "Medicine", "Cardiology", "Dermatology", "Gynecology",
  "Pediatrics", "Neurology", "Orthopedics", "Psychiatry",
];
const LANGUAGES = ["Bengali", "English", "Hindi", "Urdu", "Chittagonian", "Sylheti"];

function DoctorsSearchPageInner() {
  const searchParams = useSearchParams();
  const { t } = useLang();

  const [specialization, setSpecialization] = useState(
    searchParams.get("specialization") || ""
  );
  const [minFee, setMinFee] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [minRating, setMinRating] = useState("");
  const [gender, setGender] = useState("");
  const [language, setLanguage] = useState("");
  const [availableToday, setAvailableToday] = useState(false);
  const [sort, setSort] = useState("rating");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState("");

  const [doctors, setDoctors] = useState<DoctorSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (specialization) params.set("specialization", specialization);
    if (minFee) params.set("minFee", minFee);
    if (maxFee) params.set("maxFee", maxFee);
    if (minRating) params.set("minRating", minRating);
    if (gender) params.set("gender", gender);
    if (language) params.set("language", language);
    if (availableToday) params.set("availableToday", "true");
    if (sort) params.set("sort", sort);
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      if (maxDistanceKm) params.set("maxDistanceKm", maxDistanceKm);
    }

    try {
      const res = await fetch(`/api/doctors?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load doctors");
      setDoctors(data.doctors);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [specialization, minFee, maxFee, minRating, gender, language, availableToday, sort, coords, maxDistanceKm]);

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Could not get your location")
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="h-fit rounded-xl border bg-white p-5">
        <h2 className="mb-4 font-semibold">{t("filters")}</h2>

        <label className="mb-1 block text-sm font-medium">{t("specialization")}</label>
        <select
          className="mb-4 w-full rounded border p-2 text-sm"
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
        >
          <option value="">{t("allSpecializations")}</option>
          {SPECIALIZATIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium">{t("feeRange")}</label>
        <div className="mb-4 flex gap-2">
          <input
            type="number" placeholder={t("min")}
            className="w-1/2 rounded border p-2 text-sm"
            value={minFee} onChange={(e) => setMinFee(e.target.value)}
          />
          <input
            type="number" placeholder={t("max")}
            className="w-1/2 rounded border p-2 text-sm"
            value={maxFee} onChange={(e) => setMaxFee(e.target.value)}
          />
        </div>

        <label className="mb-1 block text-sm font-medium">{t("minRating")}</label>
        <select
          className="mb-4 w-full rounded border p-2 text-sm"
          value={minRating} onChange={(e) => setMinRating(e.target.value)}
        >
          <option value="">{t("any")}</option>
          <option value="3">3+ ⭐</option>
          <option value="4">4+ ⭐</option>
          <option value="4.5">4.5+ ⭐</option>
        </select>

        <label className="mb-1 block text-sm font-medium">{t("doctorGender")}</label>
        <select
          className="mb-4 w-full rounded border p-2 text-sm"
          value={gender} onChange={(e) => setGender(e.target.value)}
        >
          <option value="">{t("any")}</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </select>

        <label className="mb-1 block text-sm font-medium">{t("language")}</label>
        <select
          className="mb-4 w-full rounded border p-2 text-sm"
          value={language} onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">{t("any")}</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <label className="mb-4 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={availableToday}
            onChange={(e) => setAvailableToday(e.target.checked)}
          />
          {t("availableToday")}
        </label>

        <label className="mb-1 block text-sm font-medium">{t("distance")}</label>
        <button
          type="button" onClick={handleUseLocation}
          className="mb-2 w-full rounded border p-2 text-sm hover:bg-gray-50"
        >
          {coords ? `📍 ${t("locationSet")}` : t("useMyLocation")}
        </button>
        {coords && (
          <input
            type="number" placeholder={t("maxDistance")}
            className="mb-4 w-full rounded border p-2 text-sm"
            value={maxDistanceKm} onChange={(e) => setMaxDistanceKm(e.target.value)}
          />
        )}

        <label className="mb-1 block text-sm font-medium">{t("sortBy")}</label>
        <select
          className="mb-4 w-full rounded border p-2 text-sm"
          value={sort} onChange={(e) => setSort(e.target.value)}
        >
          <option value="rating">{t("highestRated")}</option>
          <option value="fee">{t("lowestFee")}</option>
          <option value="experience">Most experienced</option>
          <option value="distance">{t("nearest")}</option>
        </select>

        <button
          onClick={fetchDoctors}
          className="w-full rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600"
        >
          {t("applyFilters")}
        </button>
      </aside>

      <div>
        <h1 className="mb-4 text-xl font-semibold">
          {loading ? t("searching") : `${doctors.length} ${t("doctorsFound")}`}
        </h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doctor={d} />
          ))}
        </div>
        {!loading && doctors.length === 0 && (
          <p className="text-gray-500">{t("noDoctors")}</p>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams() needs a Suspense boundary above it, otherwise Next.js
 * cannot prerender this route at build time.
 */
export default function DoctorsSearchPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading doctors…</p>}>
      <DoctorsSearchPageInner />
    </Suspense>
  );
}
