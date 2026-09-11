import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateFlags, SubmittedAnswer } from "@/lib/intake-questions";

/**
 * POST /api/appointments { slotId, patientProfileId?, answers[] }
 *
 * Books a slot and stores the patient's intake answers. The appointment is
 * created PENDING_PAYMENT; payment moves it to PENDING_DOCTOR_REVIEW, where
 * the doctor reads the answers and decides.
 *
 * The slot is locked inside a transaction to prevent double-booking.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { slotId, patientProfileId, answers } = await req.json();

  if (!slotId) {
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });
  }

  // If booking for a family member, make sure it belongs to this account
  if (patientProfileId) {
    const profile = await prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
    });
    if (!profile || profile.accountId !== userId) {
      return NextResponse.json({ error: "Invalid patient profile" }, { status: 403 });
    }
  }

  try {
    const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const slot = await tx.slot.findUnique({
        where: { id: slotId },
        include: { doctor: true },
      });

      if (!slot) throw new Error("SLOT_NOT_FOUND");
      if (slot.isBooked) throw new Error("SLOT_ALREADY_BOOKED");
      if (slot.startTime < new Date()) throw new Error("SLOT_IN_PAST");

      await tx.slot.update({ where: { id: slotId }, data: { isBooked: true } });

      const created = await tx.appointment.create({
        data: {
          patientId: userId,
          patientProfileId: patientProfileId ?? null,
          doctorId: slot.doctorId,
          slotId: slot.id,
          feeBdt: slot.doctor.feeBdt,
          status: "PENDING_PAYMENT",
        },
      });

      // Store the intake answers alongside the appointment
      if (Array.isArray(answers) && answers.length > 0) {
        const typed = answers as SubmittedAnswer[];
        const { flagged, reasons } = evaluateFlags(slot.doctor.specialization, typed);

        await tx.intakeResponse.create({
          data: {
            appointmentId: created.id,
            specialization: slot.doctor.specialization,
            answers: typed as unknown as any,
            flaggedForReview: flagged,
            flagReason: reasons.length > 0 ? reasons.join(" • ") : null,
          },
        });
      }

      return created;
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (err: any) {
    if (err.message === "SLOT_ALREADY_BOOKED") {
      return NextResponse.json({ error: "That slot was just taken" }, { status: 409 });
    }
    if (err.message === "SLOT_NOT_FOUND") {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    if (err.message === "SLOT_IN_PAST") {
      return NextResponse.json({ error: "That slot is in the past" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }
}

/** GET /api/appointments — the logged-in user's appointments (patient or doctor view) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  if (role === "DOCTOR") {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId } });
    if (!doctorProfile) return NextResponse.json({ appointments: [] });

    const appointments = await prisma.appointment.findMany({
      where: { doctorId: doctorProfile.id },
      include: {
        patient: { select: { name: true, phone: true, email: true } },
        patientProfile: true,
        slot: true,
        proposedSlot: true,
        payment: true,
        intake: true,
        review: { include: { reply: true } },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    });

    // Surface flagged + urgent items first, then everything else by date
    const score = (x: { urgency: string; intake: { flaggedForReview: boolean } | null }) =>
      (x.urgency === "URGENT" ? 2 : 0) + (x.intake?.flaggedForReview ? 1 : 0);
    appointments.sort((a: any, b: any) => score(b) - score(a));

    return NextResponse.json({ appointments });
  }

  const appointments = await prisma.appointment.findMany({
    where: { patientId: userId },
    include: {
      doctor: { include: { user: { select: { name: true } }, hospital: true } },
      patientProfile: true,
      slot: true,
      proposedSlot: true,
      payment: true,
      review: { include: { reply: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ appointments });
}
