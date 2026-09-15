import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

const reviewSchema = z.object({
  appointmentId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  // Publicly rendered on the doctor's profile. React escapes it on the way
  // out; this caps the size and trims blank submissions on the way in.
  comment: z.string().trim().max(2000).optional().nullable(),
});

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

  const limited = rateLimit("review", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { appointmentId, rating, comment } = parsed.data;

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
      comment: comment || null,
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
