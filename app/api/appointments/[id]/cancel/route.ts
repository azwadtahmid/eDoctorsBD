import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/**
 * POST /api/appointments/:id/cancel { reason? }
 * Either the patient or the doctor can cancel an appointment that hasn't
 * happened yet. The slot is released and any payment marked for refund.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("appointment-cancel", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: true },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const isPatient = appointment.patientId === userId;
  const isDoctor = role === "DOCTOR" && appointment.doctor.userId === userId;
  if (!isPatient && !isDoctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cancellable = ["PENDING_PAYMENT", "PENDING_DOCTOR_REVIEW", "BOOKED", "RESCHEDULE_PROPOSED"];
  if (!cancellable.includes(appointment.status)) {
    return NextResponse.json(
      { error: `Cannot cancel an appointment that is ${appointment.status}` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.slot.update({ where: { id: appointment.slotId }, data: { isBooked: false } });

    if (appointment.proposedSlotId) {
      await tx.slot.update({
        where: { id: appointment.proposedSlotId },
        data: { isBooked: false },
      });
    }

    await tx.payment.updateMany({
      where: { appointmentId: appointment.id, status: "PAID" },
      data: {
        status: "REFUND_PENDING",
        refundNote: `Cancelled by ${isDoctor ? "doctor" : "patient"}`,
      },
    });

    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLED",
        proposedSlotId: null,
        cancelledBy: isDoctor ? "DOCTOR" : "PATIENT",
        cancelReason: body.reason ?? null,
      },
    });
  });

  return NextResponse.json(updated);
}
