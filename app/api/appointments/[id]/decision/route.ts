import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/**
 * POST /api/appointments/:id/decision
 *
 * The doctor reviews the patient's intake answers and decides what happens.
 * Every one of these is a HUMAN decision — nothing here is automated, and
 * the intake flags only changed the ORDER the doctor saw things in.
 *
 * Actions:
 *   accept            -> BOOKED
 *   reject            -> REJECTED (+ refund marked pending)
 *   set_urgency       -> flips urgency NORMAL/URGENT, status unchanged
 *   propose_reschedule-> RESCHEDULE_PROPOSED, holds a second slot
 */
const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal("set_urgency"), urgency: z.enum(["NORMAL", "URGENT"]) }),
  z.object({
    action: z.literal("propose_reschedule"),
    newSlotId: z.string(),
    reason: z.string().max(500).optional(),
  }),
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = rateLimit("appointment-decision", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
  if (!doctor) return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment || appointment.doctorId !== doctor.id) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const parsed = decisionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision payload" }, { status: 400 });
  }
  const body = parsed.data;

  const decidable = ["PENDING_DOCTOR_REVIEW", "BOOKED", "RESCHEDULE_PROPOSED"];
  if (!decidable.includes(appointment.status)) {
    return NextResponse.json(
      { error: `Cannot act on an appointment that is ${appointment.status}` },
      { status: 400 }
    );
  }

  if (body.action === "set_urgency") {
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { urgency: body.urgency },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "accept") {
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "BOOKED", doctorDecisionAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "reject") {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // free the slot back up
      await tx.slot.update({
        where: { id: appointment.slotId },
        data: { isBooked: false },
      });

      // mark the payment for refund (a real deployment would call the
      // gateway's refund API here; this demo records the intent)
      await tx.payment.updateMany({
        where: { appointmentId: appointment.id, status: "PAID" },
        data: { status: "REFUND_PENDING", refundNote: "Appointment declined by doctor" },
      });

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "REJECTED",
          decisionNote: body.reason,
          doctorDecisionAt: new Date(),
        },
      });
    });
    return NextResponse.json(updated);
  }

  // propose_reschedule
  const newSlot = await prisma.slot.findUnique({ where: { id: body.newSlotId } });
  if (!newSlot || newSlot.doctorId !== doctor.id) {
    return NextResponse.json({ error: "Proposed slot not found" }, { status: 404 });
  }
  if (newSlot.isBooked) {
    return NextResponse.json({ error: "That slot is already taken" }, { status: 409 });
  }
  if (newSlot.startTime < new Date()) {
    return NextResponse.json({ error: "Cannot propose a time in the past" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // hold the proposed slot so nobody else books it while the patient decides
    await tx.slot.update({ where: { id: newSlot.id }, data: { isBooked: true } });

    // release any previously proposed slot
    if (appointment.proposedSlotId && appointment.proposedSlotId !== newSlot.id) {
      await tx.slot.update({
        where: { id: appointment.proposedSlotId },
        data: { isBooked: false },
      });
    }

    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "RESCHEDULE_PROPOSED",
        proposedSlotId: newSlot.id,
        decisionNote: body.reason ?? null,
        doctorDecisionAt: new Date(),
      },
    });
  });

  return NextResponse.json(updated);
}
