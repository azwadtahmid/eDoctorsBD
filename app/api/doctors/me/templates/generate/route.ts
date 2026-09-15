import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/**
 * POST /api/doctors/me/templates/generate { weeks }
 *
 * Turns the doctor's active recurring rules into concrete Slot rows for the
 * next N weeks. Existing slots at the same start time are skipped, so this is
 * safe to run repeatedly.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = rateLimit("slot-generate", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const weeks = Math.min(Math.max(Number(body.weeks) || 4, 1), 12);

  const templates = await prisma.availabilityTemplate.findMany({
    where: { doctorId: doctor.id, active: true },
  });

  if (templates.length === 0) {
    return NextResponse.json(
      { error: "No active recurring rules to generate from" },
      { status: 400 }
    );
  }

  const now = new Date();
  const candidates: { startTime: Date; endTime: Date }[] = [];

  for (let dayOffset = 0; dayOffset < weeks * 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    for (const tpl of templates) {
      if (day.getDay() !== tpl.dayOfWeek) continue;

      const [sh, sm] = tpl.startTime.split(":").map(Number);
      const [eh, em] = tpl.endTime.split(":").map(Number);

      const blockStart = new Date(day);
      blockStart.setHours(sh, sm, 0, 0);
      const blockEnd = new Date(day);
      blockEnd.setHours(eh, em, 0, 0);

      let cursor = new Date(blockStart);
      while (cursor.getTime() + tpl.slotDurationMins * 60_000 <= blockEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + tpl.slotDurationMins * 60_000);
        if (cursor > now) {
          candidates.push({ startTime: new Date(cursor), endTime: slotEnd });
        }
        cursor = slotEnd;
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  // Skip any start times the doctor already has a slot for
  const existing = await prisma.slot.findMany({
    where: {
      doctorId: doctor.id,
      startTime: { in: candidates.map((c: any) => c.startTime) },
    },
    select: { startTime: true },
  });
  const existingTimes = new Set(existing.map((e: any) => e.startTime.getTime()));

  const toCreate = candidates.filter((c) => !existingTimes.has(c.startTime.getTime()));

  const result = await prisma.slot.createMany({
    data: toCreate.map((c: any) => ({
      doctorId: doctor.id,
      startTime: c.startTime,
      endTime: c.endTime,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    created: result.count,
    skipped: candidates.length - result.count,
  });
}
