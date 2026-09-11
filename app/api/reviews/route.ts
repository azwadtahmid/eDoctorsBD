import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews { appointmentId, rating, comment }
 * Reviews can only be left by the patient on their own COMPLETED
 * appointment, and only once. After creating it, the doctor's
 * avgRating/reviewCount are recomputed.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { appointmentId, rating, comment } = await req.json();

  if (!appointmentId || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { review: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.patientId !== (session.user as any).id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (appointment.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "You can only review a completed appointment" },
      { status: 400 }
    );
  }
  if (appointment.review) {
    return NextResponse.json({ error: "Appointment already reviewed" }, { status: 409 });
  }

  const review = await prisma.review.create({
    data: {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      rating,
      comment,
    },
  });

  const agg = await prisma.review.aggregate({
    where: { doctorId: appointment.doctorId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.doctorProfile.update({
    where: { id: appointment.doctorId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
    },
  });

  return NextResponse.json(review, { status: 201 });
}
