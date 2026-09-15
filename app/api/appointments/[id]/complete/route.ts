import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/**
 * POST /api/appointments/:id/complete { consultationNotes?, prescription? }
 * The doctor marks a confirmed appointment as done and records what was
 * discussed. The patient can read these notes afterwards from their dashboard.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = rateLimit("appointment-complete", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
  if (!doctorProfile) {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment || appointment.doctorId !== doctorProfile.id) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.status !== "BOOKED") {
    return NextResponse.json(
      { error: "Only a confirmed appointment can be completed" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const updated = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      status: "COMPLETED",
      consultationNotes: body.consultationNotes ?? null,
      prescription: body.prescription ?? null,
    },
  });

  return NextResponse.json(updated);
}
