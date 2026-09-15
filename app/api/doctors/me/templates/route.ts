import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

async function requireDoctor() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") return null;
  return prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
}

/** GET /api/doctors/me/templates — recurring weekly availability rules */
export async function GET() {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = rateLimit("doctor-templates", doctor.id, RULES.read);
  if (limited) return limited;

  const templates = await prisma.availabilityTemplate.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ templates });
}

const templateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMins: z.number().int().min(5).max(180).default(20),
});

/** POST /api/doctors/me/templates — create a recurring rule */
export async function POST(req: NextRequest) {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = rateLimit("doctor-templates", doctor.id, RULES.write);
  if (limited) return limited;

  const parsed = templateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data" }, { status: 400 });
  }

  const { startTime, endTime } = parsed.data;
  if (startTime >= endTime) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const template = await prisma.availabilityTemplate.create({
    data: { ...parsed.data, doctorId: doctor.id },
  });

  return NextResponse.json(template, { status: 201 });
}

/** DELETE /api/doctors/me/templates?id=... */
export async function DELETE(req: NextRequest) {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = rateLimit("doctor-templates", doctor.id, RULES.write);
  if (limited) return limited;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const template = await prisma.availabilityTemplate.findUnique({ where: { id } });
  if (!template || template.doctorId !== doctor.id) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.availabilityTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
