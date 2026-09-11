"use client";

import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";

const POPULAR_SPECIALIZATIONS = [
  "Medicine", "Cardiology", "Dermatology", "Gynecology",
  "Pediatrics", "Neurology", "Orthopedics", "Psychiatry",
];

export default function HomePage() {
  const { t } = useLang();

  return (
    <div>
      <section className="rounded-2xl bg-brand-500 px-8 py-16 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mt-3 max-w-xl text-brand-50">{t("heroSub")}</p>
        <Link
          href="/doctors"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 hover:bg-brand-50"
        >
          {t("findDoctor")}
        </Link>
      </section>

      <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
        <p className="font-semibold text-red-900">Not for emergencies</p>
        <p className="text-red-800">
          For severe chest pain, difficulty breathing, heavy bleeding, sudden
          weakness or loss of consciousness, call <strong>999</strong> or go to
          your nearest hospital — do not wait for an appointment.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">{t("browseBySpec")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POPULAR_SPECIALIZATIONS.map((s) => (
            <Link
              key={s}
              href={`/doctors?specialization=${encodeURIComponent(s)}`}
              className="rounded-lg border bg-white p-4 text-center font-medium hover:border-brand-500 hover:text-brand-600"
            >
              {s}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
