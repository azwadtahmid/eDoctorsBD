"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  appointment: { status: string; patientProfile: { name: string } | null } | null;
}

interface Template {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // single slot form
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(20);

  // template form
  const [tplDay, setTplDay] = useState(1);
  const [tplStart, setTplStart] = useState("10:00");
  const [tplEnd, setTplEnd] = useState("13:00");
  const [tplDuration, setTplDuration] = useState(20);
  const [weeks, setWeeks] = useState(4);

  const load = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([
      fetch("/api/doctors/me/slots").then((r) => r.json()),
      fetch("/api/doctors/me/templates").then((r) => r.json()),
    ]);
    setSlots(s.slots ?? []);
    setTemplates(t.templates ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addSlot = async () => {
    setError(null);
    setMsg(null);
    if (!date || !time) {
      setError("Pick a date and time");
      return;
    }
    const res = await fetch("/api/doctors/me/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(`${date}T${time}`).toISOString(),
        durationMins: duration,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not add slot");
      return;
    }
    setMsg("Slot added");
    setTime("");
    load();
  };

  const deleteSlot = async (id: string) => {
    const res = await fetch(`/api/doctors/me/slots?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not delete");
      return;
    }
    load();
  };

  const addTemplate = async () => {
    setError(null);
    const res = await fetch("/api/doctors/me/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: tplDay,
        startTime: tplStart,
        endTime: tplEnd,
        slotDurationMins: tplDuration,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not add rule");
      return;
    }
    load();
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/doctors/me/templates?id=${id}`, { method: "DELETE" });
    load();
  };

  const generate = async () => {
    setError(null);
    const res = await fetch("/api/doctors/me/templates/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not generate");
      return;
    }
    setMsg(`Created ${d.created} new slots (${d.skipped} already existed)`);
    load();
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/doctor" className="text-sm text-brand-600 underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-xl font-semibold">Manage availability</h1>

      {msg && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{msg}</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Single slot */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Add a one-off slot</h2>
          <div className="space-y-2">
            <input
              type="date"
              className="w-full rounded border p-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              type="time"
              className="w-full rounded border p-2 text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <select
              className="w-full rounded border p-2 text-sm"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[10, 15, 20, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
            <button
              onClick={addSlot}
              className="w-full rounded bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add slot
            </button>
          </div>
        </section>

        {/* Recurring */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Recurring weekly hours</h2>
          <div className="space-y-2">
            <select
              className="w-full rounded border p-2 text-sm"
              value={tplDay}
              onChange={(e) => setTplDay(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  Every {d}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="time"
                className="w-1/2 rounded border p-2 text-sm"
                value={tplStart}
                onChange={(e) => setTplStart(e.target.value)}
              />
              <input
                type="time"
                className="w-1/2 rounded border p-2 text-sm"
                value={tplEnd}
                onChange={(e) => setTplEnd(e.target.value)}
              />
            </div>
            <select
              className="w-full rounded border p-2 text-sm"
              value={tplDuration}
              onChange={(e) => setTplDuration(Number(e.target.value))}
            >
              {[10, 15, 20, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d} minute appointments
                </option>
              ))}
            </select>
            <button
              onClick={addTemplate}
              className="w-full rounded border py-2 text-sm font-medium hover:bg-gray-50"
            >
              Add recurring rule
            </button>
          </div>

          {templates.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center justify-between text-sm">
                  <span>
                    Every {DAYS[tpl.dayOfWeek]} {tpl.startTime}–{tpl.endTime} (
                    {tpl.slotDurationMins}m)
                  </span>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <select
                  className="rounded border p-2 text-sm"
                  value={weeks}
                  onChange={(e) => setWeeks(Number(e.target.value))}
                >
                  {[1, 2, 4, 8, 12].map((w) => (
                    <option key={w} value={w}>
                      Next {w} week{w > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={generate}
                  className="flex-1 rounded bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Generate slots
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Upcoming slots ({slots.length})</h2>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {!loading && slots.length === 0 && (
          <p className="text-sm text-gray-500">
            No upcoming slots. Patients cannot book you until you add some.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded border p-2 text-sm ${
                s.isBooked ? "bg-gray-50" : ""
              }`}
            >
              <div>
                <p>{new Date(s.startTime).toLocaleString()}</p>
                {s.isBooked && (
                  <p className="text-xs text-gray-500">
                    Booked{s.appointment?.patientProfile ? ` — ${s.appointment.patientProfile.name}` : ""}
                  </p>
                )}
              </div>
              {!s.isBooked && (
                <button
                  onClick={() => deleteSlot(s.id)}
                  className="text-xs text-red-600 hover:underline"
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
