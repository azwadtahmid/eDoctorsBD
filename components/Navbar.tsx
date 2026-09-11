"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useLang } from "./LanguageProvider";

export default function Navbar() {
  const { data: session } = useSession();
  const { lang, setLang, t } = useLang();
  const role = (session?.user as any)?.role;

  const dashboardHref =
    role === "DOCTOR"
      ? "/dashboard/doctor"
      : role === "ADMIN"
      ? "/dashboard/admin"
      : "/dashboard/patient";

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-700">
          {t("brand")}
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="rounded border px-2 py-1 text-xs font-medium hover:bg-gray-50"
            aria-label="Toggle language"
          >
            {lang === "en" ? "বাংলা" : "English"}
          </button>

          {role !== "DOCTOR" && role !== "ADMIN" && (
            <Link href="/doctors" className="hover:text-brand-600">
              {t("findDoctor")}
            </Link>
          )}

          {session?.user ? (
            <>
              <Link href={dashboardHref} className="hover:text-brand-600">
                {t("dashboard")}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded bg-gray-100 px-3 py-1.5 hover:bg-gray-200"
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-600">
                {t("logIn")}
              </Link>
              <Link
                href="/register"
                className="rounded bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600"
              >
                {t("signUp")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
