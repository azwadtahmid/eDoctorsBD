import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireDoctor() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") return null;
  return prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
}

/** GET /api/doctors/me/slots — the doctor's own upcoming slots */
export async function GET() {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const slots = await prisma.slot.findMany({
    where: { doctorId: doctor.id, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: {
      appointment: {
        select: { id: true, status: true, patientProfile: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ slots });
}

const createSchema = z.object({
  startTime: z.string(), // ISO datetime
  durationMins: z.number().int().min(5).max(180).default(20),
});

/** POST /api/doctors/me/slots — add a single slot */
export async function POST(req: NextRequest) {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid slot data" }, { status: 400 });
  }

  const start = new Date(parsed.data.startTime);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  if (start < new Date()) {
    return NextResponse.json({ error: "Cannot create a slot in the past" }, { status: 400 });
  }

  const end = new Date(start.getTime() + parsed.data.durationMins * 60_000);

  try {
    const slot = await prisma.slot.create({
      data: { doctorId: doctor.id, startTime: start, endTime: end },
    });
    return NextResponse.json(slot, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "You already have a slot starting at that time" },
        { status: 409 }
      );
    }
    throw err;
  }
}

/** DELETE /api/doctors/me/slots?id=... — remove an unbooked slot */
export async function DELETE(req: NextRequest) {
  const doctor = await requireDoctor();
  if (!doctor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing slot id" }, { status: 400 });

  const slot = await prisma.slot.findUnique({ where: { id } });
  if (!slot || slot.doctorId !== doctor.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  if (slot.isBooked) {
    return NextResponse.json(
      { error: "This slot is already booked — cancel the appointment instead" },
      { status: 409 }
    );
  }

  await prisma.slot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
