import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/appointments/:id/reschedule-response { accept: boolean }
 *
 * The patient accepts the doctor's proposed new time (the appointment moves
 * to that slot and is confirmed) or declines it (the appointment is cancelled
 * and the payment marked for refund).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment || appointment.patientId !== (session.user as any).id) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.status !== "RESCHEDULE_PROPOSED" || !appointment.proposedSlotId) {
    return NextResponse.json({ error: "No pending reschedule proposal" }, { status: 400 });
  }

  const { accept } = await req.json();
  const oldSlotId = appointment.slotId;
  const newSlotId = appointment.proposedSlotId;

  if (accept) {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // release the original slot, keep the proposed one held
      await tx.slot.update({ where: { id: oldSlotId }, data: { isBooked: false } });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          slotId: newSlotId,
          proposedSlotId: null,
          status: "BOOKED",
        },
      });
    });
    return NextResponse.json(updated);
  }

  // Declined — free both slots and refund
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.slot.update({ where: { id: oldSlotId }, data: { isBooked: false } });
    await tx.slot.update({ where: { id: newSlotId }, data: { isBooked: false } });

    await tx.payment.updateMany({
      where: { appointmentId: appointment.id, status: "PAID" },
      data: { status: "REFUND_PENDING", refundNote: "Patient declined proposed new time" },
    });

    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLED",
        proposedSlotId: null,
        cancelledBy: "PATIENT",
        cancelReason: "Declined the doctor's proposed new time",
      },
    });
  });

  return NextResponse.json(updated);
}
