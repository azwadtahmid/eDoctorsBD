"use client";

import { useEffect, useState } from "react";
import { useLang } from "./LanguageProvider";
import type { IntakeQuestion, SubmittedAnswer } from "@/lib/intake-questions";

interface Props {
  specialization: string;
  onSubmit: (answers: SubmittedAnswer[]) => void;
  onBack: () => void;
  submitting?: boolean;
}

interface QuestionPayload {
  questions: IntakeQuestion[];
  emergencyNotice: any;
  crisisResources: any;
}

export default function IntakeForm({
  specialization,
  onSubmit,
  onBack,
  submitting,
}: Props) {
  const { lang, t } = useLang();
  const [data, setData] = useState<QuestionPayload | null>(null);
  const [values, setValues] = useState<Record<string, string | string[] | number>>({});
  const [showCrisis, setShowCrisis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/intake-questions?specialization=${encodeURIComponent(specialization)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load the questions. Please try again."));
  }, [specialization]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading questions…</p>;

  const label = (q: IntakeQuestion) => (lang === "bn" && q.labelBn ? q.labelBn : q.label);
  const optionLabel = (q: IntakeQuestion, idx: number) =>
    lang === "bn" && q.optionsBn?.[idx] ? q.optionsBn[idx] : q.options![idx];

  const setValue = (q: IntakeQuestion, value: string | string[] | number) => {
    setValues((v) => ({ ...v, [q.id]: value }));

    // If this answer is one that should surface crisis support, show it
    // immediately — not after submitting, not only to the doctor.
    if (q.showCrisisSupportIfAnswerIn) {
      const given = Array.isArray(value) ? value : [String(value)];
      if (given.some((g) => q.showCrisisSupportIfAnswerIn!.includes(g))) {
        setShowCrisis(true);
      }
    }
  };

  const toggleMulti = (q: IntakeQuestion, option: string) => {
    const current = (values[q.id] as string[]) ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue(q, next);
  };

  const handleSubmit = () => {
    const missing = data.questions.filter((q) => {
      if (!q.required) return false;
      const v = values[q.id];
      if (v === undefined || v === "") return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });

    if (missing.length > 0) {
      setError(`Please answer: ${missing.map((m) => label(m)).join(", ")}`);
      return;
    }

    setError(null);

    const answers: SubmittedAnswer[] = data.questions
      .filter((q) => values[q.id] !== undefined && values[q.id] !== "")
      .map((q) => ({
        questionId: q.id,
        question: q.label,
        answer: values[q.id],
      }));

    onSubmit(answers);
  };

  const notice = data.emergencyNotice[lang] ?? data.emergencyNotice.en;
  const crisis = data.crisisResources[lang] ?? data.crisisResources.en;

  return (
    <div className="space-y-5">
      {/* Emergency screening — always visible, before any question */}
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
        <p className="font-semibold text-red-900">{notice.title}</p>
        <p className="mt-1 text-sm text-red-800">{notice.body}</p>
        <p className="mt-2 text-sm font-semibold text-red-900">{notice.action}</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t("beforeYouBook")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("intakeIntro")}</p>
      </div>

      {/* Crisis support — appears the moment a patient indicates self-harm thoughts */}
      {showCrisis && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">{crisis.title}</p>
          <p className="mt-1 text-sm text-amber-900">{crisis.body}</p>
          <ul className="mt-2 space-y-1 text-sm font-medium text-amber-900">
            {crisis.resources.map((r: string) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-amber-900">{crisis.footer}</p>
        </div>
      )}

      <div className="space-y-5">
        {data.questions.map((q, qi) => (
          <div key={q.id}>
            <label className="block text-sm font-medium">
              {qi + 1}. {label(q)}
              {q.required && <span className="text-red-600"> *</span>}
            </label>
            {q.helpText && (
              <p className="mb-1 mt-0.5 text-xs text-gray-500">{q.helpText}</p>
            )}

            {q.type === "text" && (
              <input
                type="text"
                className="mt-1 w-full rounded border p-2 text-sm"
                value={(values[q.id] as string) ?? ""}
                onChange={(e) => setValue(q, e.target.value)}
              />
            )}

            {q.type === "textarea" && (
              <textarea
                rows={3}
                className="mt-1 w-full rounded border p-2 text-sm"
                value={(values[q.id] as string) ?? ""}
                onChange={(e) => setValue(q, e.target.value)}
              />
            )}

            {q.type === "select" && (
              <div className="mt-1 space-y-1">
                {q.options!.map((opt, oi) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-sm ${
                      values[q.id] === opt ? "border-brand-500 bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={values[q.id] === opt}
                      onChange={() => setValue(q, opt)}
                    />
                    {optionLabel(q, oi)}
                  </label>
                ))}
              </div>
            )}

            {q.type === "multiselect" && (
              <div className="mt-1 flex flex-wrap gap-2">
                {q.options!.map((opt, oi) => {
                  const selected = ((values[q.id] as string[]) ?? []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMulti(q, opt)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {optionLabel(q, oi)}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "scale" && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setValue(q, n)}
                      className={`h-9 w-9 rounded border text-sm ${
                        values[q.id] === n
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="rounded bg-gray-100 p-3 text-xs text-gray-600">
        These answers are shared only with the doctor you are booking. The
        doctor reviews them and decides whether to confirm the appointment,
        suggest a different time, or ask you to be seen sooner.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          {t("back")}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="flex-1 rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? t("processing") : t("submitAndPay")}
        </button>
      </div>
    </div>
  );
}
